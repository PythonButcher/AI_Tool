"""Unsupervised detector fitting with training-only thresholds and optional truth."""

from copy import deepcopy
from dataclasses import asdict
from io import BytesIO

from .anomaly_runtime import predict_anomalies
from .clustering import aggregate_metrics, prepare_features, unsupervised_partition
from .training import TrainingFailure, make_pipeline


def evaluation_labels(data, config):
    import numpy as np
    name = config["roles"]["target"]
    if not name:
        return None
    if name not in data or data[name].isna().any() or not np.isin(data[name], [0, 1]).all():
        raise TrainingFailure("anomaly_labels_invalid", "Optional evaluation labels must be present numeric values: 0 for ordinary and 1 for known anomaly.")
    return data[name].to_numpy(dtype=int)


def fit_detector(frame, config, family):
    import numpy as np
    if len(frame) < 10:
        raise TrainingFailure("anomaly_sample_small", "Every detector training partition needs at least ten rows.", "Supply more rows or reduce the development folds.")
    if family == "local_outlier_factor" and len(frame) > 20000:
        raise TrainingFailure("anomaly_neighbor_limit", "Local neighbor detection supports at most 20000 training rows.", "Choose isolation forest or prepare a smaller dataset.")
    fit_config = deepcopy(config)
    fit_config["candidate"]["neighbors"] = min(config["candidate"]["neighbors"], len(frame) - 1)
    pipeline = make_pipeline(fit_config, family).fit(frame)
    # LOF's fitted training scores exclude each point from its own neighborhood.
    # score_samples is its novelty interface and must be reserved for new rows.
    scores = -pipeline.named_steps["model"].negative_outlier_factor_ if family == "local_outlier_factor" else -pipeline.score_samples(frame)
    if not np.isfinite(scores).all():
        raise TrainingFailure("anomaly_scores_invalid", "The fitted detector produced non-finite training scores.")
    threshold = float(np.quantile(scores, 1 - config["candidate"]["contamination"], method="higher"))
    return {"estimator": pipeline, "threshold": threshold, "training_rows": len(frame), "expected_fraction": config["candidate"]["contamination"],
        "training_flag_fraction": float(np.mean(scores > threshold)), "neighbors": fit_config["candidate"]["neighbors"] if family == "local_outlier_factor" else None}


def fit_pair(frame, config, family, seed):
    import numpy as np
    model = fit_detector(frame, config, family)
    subset = np.random.default_rng(seed).choice(len(frame), max(10, int(.8 * len(frame))), replace=False)
    alternate = deepcopy(config)
    alternate["validation"]["seed"] = (seed + 1) % (2**32)
    comparison = fit_detector(frame.iloc[subset], alternate, family)
    return model, comparison


def labeled_metrics(labels, scores, flags):
    import numpy as np
    from sklearn.metrics import roc_auc_score
    if labels is None:
        return {}
    positives, flagged = int(np.sum(labels == 1)), int(np.sum(flags))
    hits = int(np.sum((labels == 1) & flags))
    return {"roc_auc": float(roc_auc_score(labels, scores)) if len(np.unique(labels)) == 2 else None,
        "precision": hits / flagged if flagged else None, "recall": hits / positives if positives else None}


def detector_metrics(model, comparison, frame, labels):
    import numpy as np
    from scipy.stats import spearmanr
    scores, flags = predict_anomalies(model, frame)
    other_scores, other_flags = predict_anomalies(comparison, frame)
    correlation = float(spearmanr(scores, other_scores).statistic) if np.ptp(scores) > 0 and np.ptp(other_scores) > 0 else None
    if correlation is not None and not np.isfinite(correlation):
        correlation = None
    union = int(np.sum(flags | other_flags))
    metrics = {"score_stability": correlation, "flag_agreement": float(np.sum(flags & other_flags)) / union if union else None, "flagged_fraction": float(np.mean(flags)), **labeled_metrics(labels, scores, flags)}
    baseline = {"score_stability": None, "flag_agreement": None, "flagged_fraction": 0.0, **labeled_metrics(labels, np.zeros(len(scores)), np.zeros(len(scores), dtype=bool))}
    return metrics, baseline, scores, flags


def score_evidence(scores, flags, *, thresholds, labels, partition):
    import numpy as np
    counts, edges = np.histogram(scores, bins=min(12, max(1, len(scores))))
    return {"kind": "anomaly_scores", "partition": partition, "rows": len(scores), "flagged_rows": int(np.sum(flags)),
        "histogram": [{"low": float(edges[index]), "high": float(edges[index + 1]), "count": int(count)} for index, count in enumerate(counts)],
        "quantiles": {str(q): float(np.quantile(scores, q)) for q in (0, .25, .5, .75, .95, 1)}, "thresholds": thresholds,
        "labeled_rows": len(labels) if labels is not None else 0,
        "known_anomalies": int(np.sum(labels == 1)) if labels is not None else None,
        "interpretation": "Larger scores mean more unusual under this detector. A flag is a review cue, not a confirmed error or probability."}


LIMITATIONS = ["Detectors and thresholds use features from training rows only; optional 0/1 labels are used only for evaluation.",
    "Thresholds are training-score quantiles. Ties, changed distributions and LOF novelty scoring can make future flag rates differ from the configured fraction.",
    "Stability measures agreement with a seeded 80% training subsample. Stable scores alone do not establish detection accuracy.",
    "Scores are model-specific and uncalibrated; they are not anomaly probabilities and cannot be compared numerically across detectors.",
    "Unusual rows require human review. The model does not determine whether they are errors, fraud or harmful events."]


def train_anomalies(data, config, progress):
    import joblib
    import numpy as np
    import pandas as pd
    import sklearn
    from threadpoolctl import threadpool_limits
    data = prepare_features(data, config)
    labels = evaluation_labels(data, config)
    partition = unsupervised_partition(data, config)
    candidates, bundles, warnings, baseline_folds = [], {}, [], []
    seed = config["validation"]["seed"]
    with threadpool_limits(limits=1):
        for family in config["candidate"]["families"]:
            folds, baselines, all_scores, all_flags, all_labels, thresholds = [], [], [], [], [], []
            for index, (train, validation) in enumerate(partition.folds):
                progress(f"{family}_fold_{index + 1}")
                model, comparison = fit_pair(data.iloc[train], config, family, (seed + index) % (2**32))
                truth = labels[validation] if labels is not None else None
                metrics, baseline, scores, flags = detector_metrics(model, comparison, data.iloc[validation], truth)
                folds.append(metrics); baselines.append(baseline); all_scores.extend(scores); all_flags.extend(flags)
                if truth is not None: all_labels.extend(truth)
                thresholds.append({"fold": index + 1, "value": model["threshold"], "training_rows": len(train), "training_flag_fraction": model["training_flag_fraction"]})
            progress(f"{family}_development_fit")
            model, comparison = fit_pair(data.iloc[partition.development], config, family, seed)
            metrics, spread, counts = aggregate_metrics(folds)
            evidence = score_evidence(np.asarray(all_scores), np.asarray(all_flags), thresholds=thresholds, labels=np.asarray(all_labels) if labels is not None else None, partition="Development validation rows; each fold uses its own fitted threshold")
            evidence.update({"valid_metric_folds": counts, "selected_threshold": model["threshold"], "expected_fraction": model["expected_fraction"]})
            if any(count < len(folds) for count in counts.values()):
                warnings.append(f"Some {family} metrics are unavailable because scores are constant, flags are absent or evaluation labels lack both classes.")
            candidates.append({"family": family, "metrics": metrics, "fold_std": spread, "fold_metrics": folds, "evidence": evidence})
            stream = BytesIO()
            joblib.dump({"pipeline": model, "stability_model": comparison, "configuration": config, "family": family,
                "development_indices": partition.development, "holdout_indices": partition.holdout}, stream, compress=3)
            bundles[family] = stream.getvalue()
            if sum(map(len, bundles.values())) > 64 * 1024 * 1024:
                raise TrainingFailure("model_size_limit", "The fitted detectors exceed the local artifact size limit.")
            baseline_folds = baselines
    return {"candidates": candidates, "bundles": bundles, "split": asdict(partition.evidence),
        "baseline": {"name": "Flag no observations", "metrics": aggregate_metrics(baseline_folds)[0]}, "warnings": warnings,
        "limitations": ["Final rows were reserved before detector fitting or threshold estimation.", *LIMITATIONS],
        "runtime_versions": {"numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__, "joblib": joblib.__version__}}


def evaluate_anomalies(bundle, data, config):
    from threadpoolctl import threadpool_limits
    data = prepare_features(data, config)
    labels = evaluation_labels(data, config)
    rows = bundle["holdout_indices"]
    truth = labels[rows] if labels is not None else None
    model = bundle["pipeline"]
    with threadpool_limits(limits=1):
        metrics, baseline, scores, flags = detector_metrics(model, bundle["stability_model"], data.iloc[rows], truth)
    evidence = score_evidence(scores, flags, thresholds=[{"value": model["threshold"], "training_rows": model["training_rows"], "training_flag_fraction": model["training_flag_fraction"]}], labels=truth, partition="Reserved final rows scored with the nominated development threshold")
    evidence.update({"selected_threshold": model["threshold"], "expected_fraction": model["expected_fraction"]})
    evidence["inference_context"] = {"threshold": model["threshold"], "expected_fraction": model["expected_fraction"], "training_rows": model["training_rows"], "flag_rule": "score > threshold"}
    return {"metrics": metrics, "baseline": baseline, "evidence": evidence, "holdout_rows": len(rows),
        "limitations": ["Only the nominated detector was scored. Final labels and scores did not tune its threshold.", *LIMITATIONS]}
