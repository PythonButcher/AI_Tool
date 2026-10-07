"""Regular-grid, multi-series rolling-origin forecast training and evaluation."""

from copy import deepcopy
from io import BytesIO

from .forecast_runtime import predict_forecast
from .training import TrainingFailure, make_pipeline, normalize_features


def measure_forecast(truth, predictions):
    import numpy as np
    residual = np.asarray(truth, dtype=float) - np.asarray(predictions, dtype=float)
    metrics = {"rmse": float(np.sqrt(np.mean(residual ** 2))), "mae": float(np.mean(np.abs(residual)))}
    if not all(np.isfinite(value) for value in metrics.values()):
        raise TrainingFailure("forecast_scale_invalid", "Forecast errors are outside the supported numeric range.", "Rescale the target and numeric features before training.")
    return metrics


def prepare_series(data, config):
    import numpy as np
    import pandas as pd
    data = normalize_features(data.reset_index(drop=True), config)
    roles, validation = config["roles"], config["validation"]
    required = roles["numeric"] + roles["categorical"] + roles["time"] + roles["group"] + [roles["target"]]
    if not set(required).issubset(data.columns) or len(data) > config["resource"]["max_rows"]:
        raise TrainingFailure("forecast_input_invalid", "The forecast data does not match its saved schema or row limit.")
    time = roles["time"][0]
    try:
        data[time] = pd.to_datetime(data[time], utc=True, errors="raise")
        if data[time].isna().any() or not np.isfinite(data[roles["target"]].to_numpy(dtype=float)).all():
            raise ValueError("missing time or nonfinite target")
        if any(not np.isfinite(data[column].dropna().to_numpy(dtype=float)).all() for column in roles["numeric"]):
            raise ValueError("nonfinite future feature")
    except (ValueError, TypeError, OverflowError) as exc:
        raise TrainingFailure("forecast_values_invalid", "Forecasting requires valid timestamps and finite numeric values.") from exc
    if roles["group"]:
        column = roles["group"][0]
        if data[column].isna().any():
            raise TrainingFailure("forecast_series_missing", "Each observation needs a series key.")
        data[column] = data[column].astype(str)
        groups = [(str(key), part.sort_values(time)) for key, part in data.groupby(column, sort=True)]
    else:
        groups = [("__single__", data.sort_values(time))]
    if len(groups) > 100:
        raise TrainingFailure("forecast_series_limit", "Local forecasting supports at most 100 series.")
    history_required = max(validation["lags"] + 10, validation["season_length"]) + (validation["folds"] + 1) * validation["horizon"]
    for _, part in groups:
        if len(part) < history_required:
            raise TrainingFailure("forecast_history_short", f"Every series needs at least {history_required} observations for the configured rolling evaluation.", "Reduce horizon, lags or folds, or supply more history.")
        expected = pd.date_range(part[time].iloc[0], periods=len(part), freq=validation["frequency"])
        if not pd.DatetimeIndex(part[time]).equals(expected):
            raise TrainingFailure("forecast_grid_invalid", "Each series must have unique, regular timestamps at the selected frequency.", "Prepare duplicate timestamps and missing periods before training.")
    return data, groups


def fit_forecaster(groups, config, family):
    import pandas as pd
    roles, settings = config["roles"], config["validation"]
    lag_names = [f"__ml_lag_{lag}" for lag in range(1, settings["lags"] + 1)]
    rows, targets = [], []
    for _, part in groups:
        frame = part[roles["numeric"] + roles["categorical"]].copy()
        for lag, name in enumerate(lag_names, start=1):
            frame[name] = part[roles["target"]].shift(lag)
        rows.append(frame.iloc[settings["lags"]:])
        targets.append(part[roles["target"]].iloc[settings["lags"]:])
    adapted = {**config, "task_type": "regression", "roles": {**roles, "numeric": roles["numeric"] + lag_names}}
    pipeline = make_pipeline(adapted, "regularized_linear" if family == "lagged_ridge" else "random_forest")
    pipeline.fit(pd.concat(rows, ignore_index=True), pd.concat(targets, ignore_index=True))
    model = {"task_type": "forecasting", "estimator": pipeline, "time_column": roles["time"][0],
        "series_column": roles["group"][0] if roles["group"] else None, "numeric": roles["numeric"], "categorical": roles["categorical"],
        "frequency": settings["frequency"], "horizon": settings["horizon"], "lags": settings["lags"], "histories": {}}
    update_origins(model, groups, config)
    return model


def update_origins(model, groups, config):
    for key, part in groups:
        model["histories"][key] = {"origin": part[config["roles"]["time"][0]].iloc[-1].isoformat(),
            "values": part[config["roles"]["target"]].iloc[-model["lags"]:].astype(float).tolist()}


def baseline_predictions(train_groups, horizon, season_length, target):
    import numpy as np
    naive, seasonal = [], []
    for _, part in train_groups:
        values = part[target].astype(float).tolist()
        naive.extend([values[-1]] * horizon)
        seasonal.extend([values[-season_length + step % season_length] for step in range(horizon)])
    return np.asarray(naive), np.asarray(seasonal)


def forecast_evidence(frame, predictions, horizons, baseline, config):
    roles = config["roles"]
    return {"kind": "forecast", "sample_limit": 100, "points": [{"time": row[roles["time"][0]].isoformat(),
        "series": str(row[roles["group"][0]]) if roles["group"] else "Single series", "horizon": int(horizons[index]),
        "actual": float(row[roles["target"]]), "predicted": float(predictions[index]), "baseline": float(baseline[index])}
        for index, (_, row) in enumerate(frame.iloc[:100].iterrows())]}


def train_forecasting(data, config, progress):
    import joblib
    import numpy as np
    import pandas as pd
    import sklearn
    from threadpoolctl import threadpool_limits
    data, groups = prepare_series(data, config)
    settings, target = config["validation"], config["roles"]["target"]
    horizon, folds = settings["horizon"], settings["folds"]
    development_groups = [(key, part.iloc[:-horizon]) for key, part in groups]
    development_indices = [int(index) for _, part in development_groups for index in part.index]
    holdout_indices = [int(index) for _, part in groups for index in part.iloc[-horizon:].index]
    from .evaluation import _structural_leakage
    findings = _structural_leakage(data.iloc[development_indices], data.iloc[development_indices][target], config["roles"]["numeric"] + config["roles"]["categorical"])
    fold_parts, naive_scores, seasonal_scores, splits = [], [], [], []
    for fold in range(folds):
        training = [(key, part.iloc[:len(part) - (folds - fold) * horizon]) for key, part in development_groups]
        validation = pd.concat([part.iloc[len(part) - (folds - fold) * horizon:len(part) - (folds - fold - 1) * horizon] for _, part in development_groups]).reset_index(drop=True)
        naive, seasonal = baseline_predictions(training, horizon, settings["season_length"], target)
        naive_scores.append(measure_forecast(validation[target], naive))
        seasonal_scores.append(measure_forecast(validation[target], seasonal))
        fold_parts.append((training, validation, naive))
        splits.append({"fold": fold + 1, "training_rows": sum(len(part) for _, part in training), "validation_rows": len(validation),
            "origins": [{"series": key, "last_training_time": part[config["roles"]["time"][0]].iloc[-1].isoformat()} for key, part in training]})
    candidates, bundles = [], {}
    with threadpool_limits(limits=1):
        for family in config["candidate"]["families"]:
            scores, plots = [], []
            for fold, (training, validation, naive) in enumerate(fold_parts):
                progress(f"{family}_rolling_origin_{fold + 1}")
                model = fit_forecaster(training, config, family)
                predictions, horizons = predict_forecast(model, validation)
                scores.append(measure_forecast(validation[target], predictions))
                plots.extend(forecast_evidence(validation, predictions, horizons, naive, config)["points"])
            model = fit_forecaster(development_groups, config, family)
            stream = BytesIO()
            joblib.dump({"pipeline": model, "configuration": config, "family": family,
                "development_indices": development_indices, "holdout_indices": holdout_indices}, stream, compress=3)
            bundles[family] = stream.getvalue()
            if sum(map(len, bundles.values())) > 64 * 1024 * 1024:
                raise TrainingFailure("model_size_limit", "The fitted forecast models exceed the 64 MB run limit.")
            candidates.append({"family": family, "metrics": {name: float(np.mean([score[name] for score in scores])) for name in scores[0]},
                "fold_std": {name: float(np.std([score[name] for score in scores])) for name in scores[0]}, "fold_metrics": scores,
                "evidence": {"kind": "forecast", "points": plots[:100], "sample_limit": 100}})
    return {"candidates": candidates, "bundles": bundles,
        "split": {"strategy": "rolling_origin", "development_rows": len(development_indices), "holdout_rows": len(holdout_indices),
            "series_count": len(groups), "horizon": horizon, "frequency": settings["frequency"], "folds": splits},
        "baseline": {"name": "Last observation", "metrics": {name: float(np.mean([score[name] for score in naive_scores])) for name in naive_scores[0]},
            "alternatives": [{"name": f"Seasonal naive ({settings['season_length']} periods)", "metrics": {name: float(np.mean([score[name] for score in seasonal_scores])) for name in seasonal_scores[0]}}]},
        "warnings": [item.message for item in findings], "limitations": ["Rolling origins and the final horizon preserve time order; forecast uncertainty grows with horizon.",
            "Future feature values must actually be known at prediction time. No prediction intervals are supplied.",
            "Only regular hourly, daily, Monday-weekly or month-start series are supported; new series require training.",
            "A shared lag model fits the series together; evaluation does not guarantee performance after a distribution change."],
        "runtime_versions": {"numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__, "joblib": joblib.__version__}}


def evaluate_forecast(bundle, data, config):
    import joblib
    import pandas as pd
    data, groups = prepare_series(data, config)
    held_out = data.iloc[bundle["holdout_indices"]].reset_index(drop=True)
    predictions, horizons = predict_forecast(bundle["pipeline"], held_out)
    horizon = config["validation"]["horizon"]
    train_groups = [(key, part.iloc[:-horizon]) for key, part in groups]
    naive, seasonal = baseline_predictions(train_groups, horizon, config["validation"]["season_length"], config["roles"]["target"])
    final = {"metrics": measure_forecast(held_out[config["roles"]["target"]], predictions),
        "baseline": measure_forecast(held_out[config["roles"]["target"]], naive),
        "evidence": {**forecast_evidence(held_out, predictions, horizons, naive, config),
            "seasonal_baseline_metrics": measure_forecast(held_out[config["roles"]["target"]], seasonal)},
        "holdout_rows": len(held_out), "limitations": ["Final metrics score the nominated model at its development origin only.",
            "Forecast coefficients stay fitted on development history. After evaluation, inference origins use the latest observed values without refitting.",
            "No forecast intervals are supplied. Future covariates must be known, not measured after the outcome."]}
    # The final calculation has finished. Updating context is not model fitting;
    # it makes the selected artifact forecast beyond the latest observed time.
    inference = deepcopy(bundle)
    update_origins(inference["pipeline"], groups, config)
    final["evidence"]["inference_context"] = {"horizon": horizon, "frequency": config["validation"]["frequency"],
        "origins": [{"series": key, "origin": value["origin"]} for key, value in inference["pipeline"]["histories"].items()]}
    stream = BytesIO()
    joblib.dump(inference, stream, compress=3)
    final["inference_bundle"] = stream.getvalue()
    return final
