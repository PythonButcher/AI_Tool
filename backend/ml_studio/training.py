"""Development-only fitting in a cancellable, time-bounded local process.

Only trusted server data enters this module. Final holdout rows are partitioned
but never scored here; fitted development models are retained for nomination.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from io import BytesIO
import multiprocessing
from time import monotonic
from typing import Any, Callable

from .contracts import (ContractObject, DatasetSnapshotIdentity, ExperimentSpecification, FeatureRoles,
                        MetricPolicy, RandomSeedPolicy, ResourceLimits, SplitPolicy, StructuredError)


class TrainingFailure(ValueError):
    def __init__(self, code: str, message: str, remediation: str = "Review the saved settings and submit a new run.") -> None:
        super().__init__(message)
        self.error = StructuredError(code=code, message=message, remediation=remediation)


class TrainingCancelled(Exception):
    """The owning service completes the durable cancellation transition."""


@dataclass(frozen=True)
class DevelopmentEvaluation(ContractObject):
    contract_version = "ml_studio_development_v1"
    run_id: str
    experiment_id: str
    specification_version: int
    dataset_snapshot: DatasetSnapshotIdentity
    configuration_id: str
    task_type: str
    split: dict
    candidates: list[dict]
    baseline: dict
    limitations: list[str]
    warnings: tuple[str, ...]
    runtime_versions: dict
    primary_metric: str
    metric_direction: str
    run_purpose: str = "development_comparison"


def supervised_specification(config: dict) -> ExperimentSpecification:
    roles, validation = config["roles"], config["validation"]
    metric = config["metric"]["primary"]
    metric = "f1_weighted" if metric == "weighted_f1" else metric
    return ExperimentSpecification(
        experiment_id=config["experiment_id"], specification_version=config["specification_version"],
        task_type=config["task_type"], target=roles["target"],
        feature_roles=FeatureRoles(tuple(roles["numeric"]), tuple(roles["categorical"])),
        excluded_columns=tuple(roles["ignored"]),
        split_policy=SplitPolicy(validation["strategy"], validation["holdout_fraction"], validation["folds"],
            time_column=roles["time"][0] if validation["strategy"] == "time_ordered" else None,
            group_column=roles["group"][0] if validation["strategy"] == "grouped" else None),
        candidate_families=tuple(config["candidate"]["families"]),
        metric_policy=MetricPolicy(metric, "minimize" if config["task_type"] == "regression" else "maximize", (metric,)),
        resource_limits=ResourceLimits(config["resource"]["max_rows"], config["resource"]["max_features"],
                                       len(config["candidate"]["families"]), config["resource"]["timeout_seconds"]),
        random_seed_policy=RandomSeedPolicy(validation["seed"], validation["seed"], validation["seed"]),
    )


def make_pipeline(config: dict, family: str):
    from sklearn.compose import ColumnTransformer
    from sklearn.cluster import KMeans, MiniBatchKMeans
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.ensemble import IsolationForest
    from sklearn.neighbors import LocalOutlierFactor
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression, Ridge
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler

    roles, seed = config["roles"], config["validation"]["seed"]
    transforms = []
    if roles["numeric"]:
        transforms.append(("numeric", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), roles["numeric"]))
    if roles["categorical"]:
        # Bound category expansion and keep wide feature spaces sparse.
        transforms.append(("categorical", Pipeline([("impute", SimpleImputer(strategy="most_frequent")),
            ("encode", OneHotEncoder(handle_unknown="ignore", max_categories=32, sparse_output=True))]), roles["categorical"]))
    if family == "isolation_forest":
        model = IsolationForest(n_estimators=100, max_samples="auto", contamination="auto", random_state=seed, n_jobs=1)
    elif family == "local_outlier_factor":
        model = LocalOutlierFactor(n_neighbors=config["candidate"]["neighbors"], novelty=True, contamination="auto", n_jobs=1)
    elif family in ("kmeans", "mini_batch_kmeans"):
        cls = KMeans if family == "kmeans" else MiniBatchKMeans
        model = cls(n_clusters=config["candidate"]["cluster_count"], n_init=10, random_state=seed, **({"batch_size": 256} if family == "mini_batch_kmeans" else {}))
    elif family == "regularized_linear":
        model = Ridge(alpha=1.0)
    elif family == "logistic":
        model = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=seed)
    elif family == "random_forest":
        cls = RandomForestRegressor if config["task_type"] == "regression" else RandomForestClassifier
        options = {"class_weight": "balanced"} if config["task_type"] == "classification" else {}
        model = cls(n_estimators=100, max_depth=12, n_jobs=1, random_state=seed, **options)
    else:
        raise TrainingFailure("candidate_unsupported", "The candidate model is unsupported.")
    return Pipeline([("preprocessor", ColumnTransformer(transforms, remainder="drop")), ("model", model)])


def measure(task: str, truth, predictions) -> dict:
    from .evaluation import _measure
    result = _measure(task, truth, predictions)
    if "f1_weighted" in result:
        result["weighted_f1"] = result.pop("f1_weighted")
    return result


def normalize_features(data, config):
    """A portable schema boundary: categorical inputs are strings or missing."""
    import numpy as np
    import pandas as pd
    normalized = data.copy()
    for column in config["roles"]["categorical"]:
        normalized[column] = normalized[column].map(lambda value: np.nan if pd.isna(value) else str(value)).astype(object)
    return normalized


def train_development(data, config: dict, progress: Callable[[str], None] = lambda _: None) -> dict:
    """Fit inside folds; return evidence plus trusted serialized fitted bundles."""
    if config["task_type"] == "forecasting":
        from .forecasting import train_forecasting
        return train_forecasting(data, config, progress)
    if config["task_type"] == "clustering":
        from .clustering import train_clustering
        return train_clustering(data, config, progress)
    if config["task_type"] == "anomaly_detection":
        from .anomalies import train_anomalies
        return train_anomalies(data, config, progress)
    import joblib
    import numpy as np
    import pandas as pd
    import sklearn
    from sklearn.metrics import confusion_matrix
    from threadpoolctl import threadpool_limits
    from .evaluation import _baseline, _partition_rows, _structural_leakage

    if config["task_type"] not in ("regression", "classification"):
        raise TrainingFailure("task_unavailable", "This task is not available for local training yet.")
    roles = config["roles"]
    features = roles["numeric"] + roles["categorical"]
    required = set(features + [roles["target"]] + roles["time"] + roles["group"])
    if not required.issubset(data.columns) or len(data) > config["resource"]["max_rows"]:
        raise TrainingFailure("training_input_invalid", "The resolved data does not fit the saved schema or row limit.")
    if data[roles["target"]].isna().any() or any(not np.isfinite(data[column].dropna().to_numpy(dtype=float)).all() for column in roles["numeric"]):
        raise TrainingFailure("nonfinite_training_data", "Target values must be present and numeric features must be finite.")
    data = normalize_features(data.reset_index(drop=True), config)
    target = data[roles["target"]]
    if config["task_type"] == "classification":
        target = target.astype(str)
    elif not np.isfinite(target.to_numpy(dtype=float)).all():
        raise TrainingFailure("nonfinite_target", "The regression target must contain finite numbers.")
    partition = _partition_rows(data, target, supervised_specification(config))
    findings = _structural_leakage(data.iloc[partition.development], target.iloc[partition.development], features)
    if any(finding.severity == "blocked" for finding in findings):
        raise TrainingFailure("leakage_detected", "A selected feature appears to reveal the target. Review feature availability before training.")
    warnings = [finding.message for finding in findings]
    candidates, bundles, baseline_folds = [], {}, []
    x = data[features]
    for fold_index, (train, validation) in enumerate(partition.folds):
        progress(f"baseline_fold_{fold_index + 1}")
        baseline = _baseline(config["task_type"])
        baseline.fit(np.zeros((len(train), 1)), target.iloc[train])
        baseline_folds.append(measure(config["task_type"], target.iloc[validation], baseline.predict(np.zeros((len(validation), 1)))))
    with threadpool_limits(limits=1):
        for family in config["candidate"]["families"]:
            scores, actual, predicted = [], [], []
            for fold_index, (train, validation) in enumerate(partition.folds):
                progress(f"{family}_fold_{fold_index + 1}")
                pipeline = make_pipeline(config, family)
                pipeline.fit(x.iloc[train], target.iloc[train])
                predictions = pipeline.predict(x.iloc[validation])
                scores.append(measure(config["task_type"], target.iloc[validation], predictions))
                actual.extend(target.iloc[validation].tolist())
                predicted.extend(predictions.tolist())
            metrics = {name: float(np.mean([fold[name] for fold in scores])) for name in scores[0]}
            spread = {name: float(np.std([fold[name] for fold in scores])) for name in scores[0]}
            if config["task_type"] == "classification":
                labels = sorted(set(actual) | set(predicted))
                evidence = {"kind": "confusion_matrix", "labels": labels, "counts": confusion_matrix(actual, predicted, labels=labels).tolist()}
            else:
                evidence = {"kind": "residuals", "points": [{"actual": float(a), "predicted": float(p), "residual": float(a - p)} for a, p in list(zip(actual, predicted))[:100]], "sample_limit": 100}
            progress(f"{family}_development_fit")
            pipeline = make_pipeline(config, family)
            pipeline.fit(x.iloc[partition.development], target.iloc[partition.development])
            stream = BytesIO()
            joblib.dump({"pipeline": pipeline, "configuration": config, "family": family,
                         "development_indices": partition.development, "holdout_indices": partition.holdout}, stream, compress=3)
            bundles[family] = stream.getvalue()
            if sum(len(value) for value in bundles.values()) > 64 * 1024 * 1024:
                raise TrainingFailure("model_size_limit", "The fitted models exceed the 64 MB local run limit.")
            candidates.append({"family": family, "metrics": metrics, "fold_std": spread, "fold_metrics": scores, "evidence": evidence})
    return {"candidates": candidates, "bundles": bundles, "split": asdict(partition.evidence),
        "baseline": {"name": "Mean prediction" if config["task_type"] == "regression" else "Majority class",
                     "metrics": {name: float(np.mean([fold[name] for fold in baseline_folds])) for name in baseline_folds[0]}},
        "warnings": warnings, "limitations": ["Development folds compare candidates; final holdout performance has not been measured.",
            "Predictions apply to data represented by this local snapshot; association does not establish causation.",
            "Fitted models use development rows only. Classification probabilities are not exposed without calibration evidence."],
        "runtime_versions": {"numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__, "joblib": joblib.__version__}}


def _training_worker(connection, data, config: dict) -> None:
    try:
        result = train_development(data, config, lambda stage: connection.send({"event": stage}))
        connection.send({"result": result})
    except Exception as exc:
        error = getattr(exc, "error", None)
        safe = error.to_dict() if isinstance(error, StructuredError) else {
            "code": "training_failed", "message": "A candidate could not fit this dataset.",
            "remediation": "Review class counts, feature types and validation settings, then retry."}
        connection.send({"error": safe})
    finally:
        connection.close()


def run_with_limits(data, config: dict, *, cancelled: Callable[[], bool], progress: Callable[[str], None], worker=_training_worker) -> dict:
    """The parent owns lifecycle; terminate the child on deadline or cancellation."""
    if int(data.memory_usage(deep=True).sum()) > 128 * 1024 * 1024:
        raise TrainingFailure("dataset_memory_limit", "Local training supports at most 128 MB of resolved data.")
    context = multiprocessing.get_context("spawn")
    reader, writer = context.Pipe(duplex=False)
    process = context.Process(target=worker, args=(writer, data, config), daemon=True)
    started = monotonic()
    try:
        process.start()
        writer.close()
        while True:
            if cancelled():
                raise TrainingCancelled()
            if monotonic() - started > config["resource"]["timeout_seconds"]:
                raise TrainingFailure("training_timeout", "Training exceeded the configured local time limit.")
            if reader.poll(.1):
                try:
                    message = reader.recv()
                except EOFError as exc:
                    raise TrainingFailure("worker_interrupted", "The local fitting process stopped without a result.") from exc
                if "event" in message:
                    progress(message["event"])
                elif "error" in message:
                    error = message["error"]
                    raise TrainingFailure(error["code"], error["message"], error["remediation"])
                else:
                    return message["result"]
            elif not process.is_alive():
                raise TrainingFailure("worker_interrupted", "The local fitting process stopped without a result.")
    finally:
        if process.pid is not None:
            process.join(timeout=.2)
            if process.is_alive():
                process.terminate()
                process.join(timeout=1)
            if process.is_alive():
                process.kill()
                process.join(timeout=1)
            process.close()
        reader.close()
        writer.close()
