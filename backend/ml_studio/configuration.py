"""Server-owned draft configuration and readiness, independent of browser state."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


DEPENDENCY_FIELDS = ("workspace_id", "snapshot_id", "task_type", "recipe_id", "recipe_version",
                     "roles", "validation", "metric", "candidate", "resource")
TASK_MODELS = {
    "regression": ("regularized_linear", "random_forest"),
    "classification": ("logistic", "random_forest"),
    "forecasting": ("lagged_ridge", "lagged_forest"),
    "clustering": ("kmeans", "mini_batch_kmeans"),
    "anomaly_detection": ("isolation_forest", "local_outlier_factor"),
}
TASK_METRICS = {"regression": ("rmse", "mae"), "classification": ("balanced_accuracy", "weighted_f1"), "forecasting": ("rmse", "mae"), "clustering": ("silhouette", "stability_ari"), "anomaly_detection": ("score_stability", "roc_auc")}


def dependency_fingerprint(draft: Mapping[str, Any]) -> str:
    """Presentation revisions do not change the scientific input identity."""
    encoded = json.dumps({key: draft.get(key) for key in DEPENDENCY_FIELDS}, sort_keys=True,
                         separators=(",", ":"), allow_nan=False).encode()
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def assess_configuration(draft: dict, snapshot: dict) -> dict:
    """Normalize bounded settings and return inspectable issues, never fitted data."""
    issues: list[dict] = []

    def issue(code: str, message: str, *, field: str | None = None, severity: str = "blocking") -> None:
        issues.append({"code": code, "message": message, "field": field, "severity": severity})

    def setting(name: str, defaults: dict) -> dict:
        supplied = draft.get(name) or {}
        if set(supplied) - set(defaults):
            issue("unsupported_setting", f"Remove unsupported {name} settings.", field=name)
        return {**defaults, **{key: value for key, value in supplied.items() if key in defaults}}

    def integer(settings: dict, key: str, low: int, high: int) -> None:
        value = settings[key]
        if type(value) is not int or not low <= value <= high:
            issue("invalid_limit", f"{key.replace('_', ' ').capitalize()} must be an integer from {low} to {high}.", field=key)

    task = draft.get("task_type")
    roles = {"target": None, "numeric": [], "categorical": [], "ignored": [], "time": [], "group": [], **deepcopy(draft.get("roles") or {})}
    profile = {column["name"]: column for column in snapshot["column_profile"]}
    assigned = ([roles["target"]] if roles["target"] else []) + [column for role in roles if role != "target" for column in roles[role]]
    if len(assigned) != len(set(assigned)):
        issue("role_conflict", "Assign each column to only one role.")
    for column in assigned:
        if column not in profile:
            issue("column_missing", "This assigned column is absent from the saved snapshot.", field=column)
    features = roles["numeric"] + roles["categorical"]
    if task not in TASK_MODELS:
        issue("task_unavailable", "This task's execution support is not available yet.")
    if not features and task != "forecasting":
        issue("features_required", "Assign at least one numeric or categorical feature.")
    if not roles["target"] and task not in ("clustering", "anomaly_detection"):
        issue("target_required", "Choose the column you want to predict.")
    if task == "clustering" and roles["target"]:
        issue("clustering_target", "Clustering has no target. Reassign this column to a feature or ignore it.")
    target = profile.get(roles["target"], {})
    if target.get("null_count", 0):
        issue("target_missing", "Prepare missing target values before training.", field=roles["target"])
    if task in ("regression", "forecasting") and target and target["logical_type"] != "numeric":
        issue("target_type", "This task requires a numeric target.", field=roles["target"])
    if target and target["distinct_count"] < 2 and task not in ("forecasting", "anomaly_detection"):
        issue("constant_target", "The target needs at least two distinct values.", field=roles["target"])
    if task == "classification" and target.get("distinct_count", 0) > 100:
        issue("too_many_classes", "Local classification supports at most 100 classes.", field=roles["target"])
    for column in roles["numeric"]:
        if column in profile and profile[column]["logical_type"] != "numeric":
            issue("numeric_type", "Use a categorical role or convert this field to numeric data.", field=column)
    for column in features:
        if column in profile and profile[column]["null_count"] == snapshot["row_count"]:
            issue("empty_feature", "Exclude this empty feature or prepare its values.", field=column)
        elif column in profile and profile[column]["null_count"]:
            issue("training_imputation", "Missing feature values will be imputed using training partitions only.", field=column, severity="warning")
    defaults = {"strategy": "stratified" if task == "classification" else "random", "holdout_fraction": .2, "folds": 3, "seed": 42}
    if task == "forecasting":
        defaults = {"strategy": "rolling_origin", "folds": 3, "seed": 42, "horizon": 7, "frequency": "D", "lags": 7, "season_length": 7, "future_features_known": False}
    validation = setting("validation", defaults)
    integer(validation, "folds", 2, 5)
    integer(validation, "seed", 0, 2**32 - 1)
    fraction = validation.get("holdout_fraction", .2)
    if isinstance(fraction, bool) or not isinstance(fraction, (float, int)) or not .1 <= fraction <= .4:
        issue("holdout_fraction", "Reserve between 10% and 40% of rows for final evaluation.")
    strategies = ("rolling_origin",) if task == "forecasting" else ("random", "stratified", "time_ordered", "grouped")
    if validation["strategy"] not in strategies:
        issue("split_strategy", "Choose a supported validation strategy.")
    if validation["strategy"] == "stratified" and task != "classification":
        issue("split_strategy", "Stratified validation is for classification.")
    for role, strategy in (("time", "time_ordered"), ("group", "grouped")):
        if validation["strategy"] == strategy and len(roles[role]) != 1:
            issue("split_role", f"Choose exactly one {role} column for this validation strategy.")
    if task == "forecasting":
        for key in ("horizon", "lags"):
            integer(validation, key, 1, 48)
        integer(validation, "season_length", 1, 366)
        if validation["frequency"] not in ("h", "D", "W-MON", "MS"):
            issue("forecast_frequency", "Choose hourly, daily, Monday weekly or month-start frequency.")
        if len(roles["time"]) != 1 or len(roles["group"]) > 1:
            issue("forecast_roles", "Choose exactly one time column and at most one series key.")
        for column in roles["time"] + roles["group"]:
            if profile.get(column, {}).get("null_count", 0):
                issue("forecast_identity_missing", "Time and series keys cannot contain missing values.", field=column)
        if features and validation["future_features_known"] is not True:
            issue("future_features_required", "Confirm that every selected feature is known for the full future horizon, or ignore those columns.")
        if any(column.startswith("__ml_lag_") for column in features):
            issue("reserved_feature_name", "Rename the selected feature to avoid the reserved lag prefix.")
        issue("forecast_grid_check", "Training checks regular timestamps, unique series/time rows and enough history for every rolling origin.", severity="warning")
        if all(type(validation[key]) is int and validation[key] > 0 for key in ("lags", "season_length", "folds", "horizon")):
            minimum_history = max(validation["lags"] + 10, validation["season_length"]) + (validation["folds"] + 1) * validation["horizon"]
            series_count = profile.get(roles["group"][0], {}).get("distinct_count", 1) if roles["group"] else 1
            if snapshot["row_count"] < minimum_history * series_count:
                issue("forecast_history_short", f"Provide at least {minimum_history} observations per series or reduce horizon, lags or folds.")
    metrics = TASK_METRICS.get(task, ("rmse",))
    metric = setting("metric", {"primary": metrics[0]})
    if metric["primary"] not in metrics:
        issue("metric_invalid", "Choose a task-appropriate selection metric.")
    if task == "anomaly_detection":
        if target and target["logical_type"] != "numeric":
            issue("anomaly_labels_invalid", "Optional evaluation labels must be numeric: 0 for ordinary, 1 for known anomaly.")
        if metric["primary"] == "roc_auc" and (not target or target.get("distinct_count") != 2):
            issue("anomaly_labels_required", "ROC AUC requires an optional evaluation label column with both 0 and 1 values.")
        issue("anomaly_interpretation", "Labels never train the detector or tune its threshold. Scores and flags describe unusual observations, not confirmed errors; unlabeled stability is not detection accuracy.", severity="warning")
    candidate_defaults = {"families": list(TASK_MODELS.get(task, ()))}
    if task == "clustering":
        candidate_defaults["cluster_count"] = 3
        issue("clustering_geometry", "Numeric inputs are standardized; categories are one-hot encoded. Euclidean distance and roughly compact groups are assumptions, not evidence of real-world segments.", severity="warning")
    if task == "anomaly_detection":
        candidate_defaults.update({"contamination": .05, "neighbors": 20})
    candidate = setting("candidate", candidate_defaults)
    if task == "clustering":
        integer(candidate, "cluster_count", 2, 12)
    if task == "anomaly_detection":
        integer(candidate, "neighbors", 5, 100)
        if type(candidate["contamination"]) not in (int, float) or not .005 <= candidate["contamination"] <= .3:
            issue("anomaly_threshold_invalid", "Expected unusual fraction must be between 0.5% and 30%; it sets a training-score quantile, not a guaranteed future flag rate.")
    families = candidate["families"]
    if (not isinstance(families, list) or not families or any(not isinstance(family, str) for family in families)
            or len(families) > 3 or len(set(families)) != len(families) or any(family not in TASK_MODELS.get(task, ()) for family in families)):
        issue("candidates_invalid", "Choose distinct supported candidate models.")
    resource = setting("resource", {"max_rows": 50000, "max_features": 100, "timeout_seconds": 120})
    integer(resource, "max_rows", 20, 100000)
    integer(resource, "max_features", 1, 200)
    integer(resource, "timeout_seconds", 5, 600)
    if type(resource["max_rows"]) is int and snapshot["row_count"] > resource["max_rows"]:
        issue("row_limit", "The dataset exceeds the configured local row limit. Prepare fewer rows or raise the limit.")
    if type(resource["max_features"]) is int and len(features) > resource["max_features"]:
        issue("feature_limit", "Select fewer features or raise the local feature limit.")
    if task == "forecasting" and type(validation["lags"]) is int and type(resource["max_features"]) is int and len(features) + validation["lags"] > resource["max_features"]:
        issue("feature_limit", "Features plus forecast lags exceed the configured feature limit.")
    if snapshot["row_count"] < 20:
        issue("small_dataset", "Use at least 20 rows for development and final evaluation.")
    governance = snapshot.get("governance_result") or {}
    if governance.get("status") in ("blocked", "not_ready") or governance.get("state") == "blocked":
        issue("governance_blocked", "Resolve the dataset's governance blockers before training.")
    fingerprint = dependency_fingerprint(draft)
    configuration = {"contract_version": "ml_studio_configuration_v1", "configuration_id": f"config-{uuid4().hex}",
        "experiment_id": f"studio-{draft['experiment_id']}", "draft_experiment_id": draft["experiment_id"],
        "workspace_id": draft["workspace_id"], "snapshot_id": draft["snapshot_id"], "draft_revision": draft["draft_revision"],
        "recipe_id": draft.get("recipe_id"), "recipe_version": draft.get("recipe_version"),
        "recipe_hash": snapshot["transformation_recipe_hash"], "input_fingerprint": fingerprint,
        "task_type": task, "roles": roles, "validation": validation, "metric": metric, "candidate": candidate, "resource": resource}
    return {"assessment_id": f"assessment-{uuid4().hex}", "assessed_at": datetime.now(UTC).isoformat(),
        "bound_draft_revision": draft["draft_revision"], "bound_etag": draft["etag"],
        "input_fingerprint": fingerprint, "state": "blocked" if any(item["severity"] == "blocking" for item in issues) else "ready",
        "issues": issues, "configuration": configuration}
