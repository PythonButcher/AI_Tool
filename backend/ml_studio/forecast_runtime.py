"""Portable forecast inference; this exact module accompanies forecast exports."""

import numpy as np
import pandas as pd


def predict_forecast(model, frame):
    """Predict each supplied horizon recursively without observing its targets."""
    time_column, series_column = model["time_column"], model["series_column"]
    data = frame.reset_index(drop=True).copy()
    data[time_column] = pd.to_datetime(data[time_column], utc=True, errors="raise")
    if data[time_column].isna().any():
        raise ValueError("Time values cannot be missing")
    if series_column:
        if data[series_column].isna().any():
            raise ValueError("Series keys cannot be missing")
        keys = data[series_column].astype(str)
    else:
        keys = pd.Series("__single__", index=data.index)
    predictions = np.empty(len(data), dtype=float)
    horizons = np.empty(len(data), dtype=int)
    for key in keys.unique():
        if key not in model["histories"]:
            raise ValueError("New series keys require a new trained model")
        history = model["histories"][key]
        indices = data.index[keys == key].tolist()
        indices.sort(key=lambda index: data.loc[index, time_column])
        expected = pd.date_range(pd.Timestamp(history["origin"]), periods=model["horizon"] + 1, freq=model["frequency"])[1:]
        actual = pd.DatetimeIndex(data.loc[indices, time_column])
        if len(indices) != model["horizon"] or not actual.equals(expected):
            raise ValueError("Provide the exact configured horizon immediately after this series origin")
        values = list(history["values"])
        for step, index in enumerate(indices, start=1):
            record = {name: data.loc[index, name] for name in model["numeric"] + model["categorical"]}
            record.update({f"__ml_lag_{lag}": values[-lag] for lag in range(1, model["lags"] + 1)})
            for name in model["categorical"]:
                record[name] = np.nan if pd.isna(record[name]) else str(record[name])
            prediction = float(model["estimator"].predict(pd.DataFrame([record]))[0])
            if not np.isfinite(prediction):
                raise ValueError("Forecasts must be finite")
            values.append(prediction)
            predictions[index], horizons[index] = prediction, step
    return predictions, horizons
