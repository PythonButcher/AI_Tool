"""ML prep readiness checks for datasets.

This module exposes endpoints that analyze the current dataset and
return actionable feedback before users run ML workflows.
"""

from flask import Blueprint, jsonify, request
import json
import pandas as pd
from backend.utils.global_state import get_cleaned_data, get_uploaded_df
from backend.services.model_training import ModelTrainingError, TrainingRequest, train_model

ml_prep_bp = Blueprint('ml_prep_bp', __name__, url_prefix='/api/ml_prep')

MODEL_DEFINITIONS = [
    {
        "id": "linear_regression",
        "name": "Linear Regression",
        "type": "regression",
        "description": "Predict a continuous numeric target using numeric features.",
    },
    {
        "id": "logistic_regression",
        "name": "Logistic Regression",
        "type": "classification",
        "description": "Predict a categorical target using encoded features.",
    },
    {
        "id": "kmeans",
        "name": "K-Means Clustering",
        "type": "clustering",
        "description": "Group records into clusters using numeric features.",
    },
]

MODEL_LOOKUP = {model["id"]: model for model in MODEL_DEFINITIONS}


def _get_dataset():
    """Return the cleaned dataset if available, otherwise fall back to the upload."""
    return get_cleaned_data() or get_uploaded_df()


def _dataset_from_payload(payload: dict):
    """Return a dataframe from payload dataset or in-memory app state."""
    payload_dataset = payload.get("dataset")
    if payload_dataset is not None:
        try:
            if isinstance(payload_dataset, list):
                return pd.DataFrame(payload_dataset)
            if isinstance(payload_dataset, dict):
                return pd.DataFrame.from_dict(payload_dataset)
        except Exception as exc:  # noqa: BLE001
            raise ModelTrainingError(f"Unable to parse dataset payload: {exc}") from exc
        raise ModelTrainingError("dataset must be a list of row objects or a column mapping.")

    return _get_dataset()


def _column_is_numeric(series: pd.Series) -> bool:
    """Determine if a column is fully numeric after coercion."""
    if series.dropna().empty:
        return False
    coerced = pd.to_numeric(series.dropna(), errors="coerce")
    return coerced.notna().all()


def _column_has_mixed_numeric_text(series: pd.Series) -> bool:
    """Detect columns that contain both numeric and non-numeric text values."""
    non_null = series.dropna()
    if non_null.empty:
        return False
    numeric_mask = pd.to_numeric(non_null, errors="coerce").notna()
    return numeric_mask.any() and (~numeric_mask).any()


def _add_unique_suggestion(items, new_item):
    """Add a suggestion only if it isn't already present."""
    def _params_key(params):
        return tuple(
            sorted(
                (key, json.dumps(value, sort_keys=True))
                for key, value in (params or {}).items()
            )
        )

    key = (
        new_item.get("action_type"),
        tuple(new_item.get("columns") or []),
        _params_key(new_item.get("params")),
        new_item.get("reason"),
        new_item.get("severity"),
    )
    existing_keys = {
        (
            item.get("action_type"),
            tuple(item.get("columns") or []),
            _params_key(item.get("params")),
            item.get("reason"),
            item.get("severity"),
        )
        for item in items
    }
    if key not in existing_keys:
        items.append(new_item)


def _build_issue(message: str, severity: str) -> dict:
    """Standardize issue payloads."""
    return {"message": message, "severity": severity}


def _check_missing_values(df: pd.DataFrame, issues: list, suggestions: list) -> None:
    """Identify missing values and recommend cleaning actions."""
    missing_counts = df.isna().sum()
    total_rows = len(df)
    for column, count in missing_counts[missing_counts > 0].items():
        percentage = (count / total_rows * 100) if total_rows else 0
        issues.append(
            _build_issue(
                f"Column '{column}' contains {percentage:.1f}% missing values ({count} rows).",
                "blocking",
            )
        )
        strategy = "median" if _column_is_numeric(df[column]) else "mode"
        _add_unique_suggestion(
            suggestions,
            {
                "action_type": "replace_nulls",
                "columns": [column],
                "params": {"columns": [column], "strategy": strategy},
                "reason": "Missing values must be handled before training.",
                "severity": "blocking",
            },
        )


def _check_mixed_types(df: pd.DataFrame, issues: list, suggestions: list) -> None:
    """Warn about columns with mixed numeric/text types."""
    for column in df.columns:
        if _column_has_mixed_numeric_text(df[column]):
            issues.append(
                _build_issue(
                    f"Column '{column}' contains mixed numeric and text values.",
                    "warning",
                )
            )
            _add_unique_suggestion(
                suggestions,
                {
                    "action_type": "convert_type",
                    "columns": [column],
                    "params": {"columns": [column], "target": "numeric"},
                    "reason": "Mixed-type columns should be normalized to a consistent numeric format.",
                    "severity": "warning",
                },
            )


def _check_row_feature_ratio(df: pd.DataFrame, feature_count: int, issues: list, suggestions: list) -> None:
    """Ensure dataset has enough rows relative to features."""
    if feature_count <= 0:
        return
    min_rows = feature_count * 5
    if len(df) < min_rows:
        issues.append(
            _build_issue(
                f"Dataset has {len(df)} rows for {feature_count} feature columns; aim for at least {min_rows} rows.",
                "info",
            )
        )


def _check_linear_regression(df: pd.DataFrame, target_column: str, issues: list, suggestions: list) -> None:
    """Run linear regression readiness checks."""
    if not _column_is_numeric(df[target_column]):
        issues.append(
            _build_issue(
                f"Target column '{target_column}' is not fully numeric. Linear regression requires a numeric target.",
                "blocking",
            )
        )
        _add_unique_suggestion(
            suggestions,
            {
                "action_type": "convert_type",
                "columns": [target_column],
                "params": {"columns": [target_column], "target": "numeric"},
                "reason": "Linear regression requires a numeric target column.",
                "severity": "blocking",
            },
        )

    feature_columns = [col for col in df.columns if col != target_column]
    non_numeric_features = [col for col in feature_columns if not _column_is_numeric(df[col])]
    for column in non_numeric_features:
        issues.append(
            _build_issue(
                f"Feature column '{column}' is not numeric. Linear regression requires numeric features.",
                "blocking",
            )
        )
    if non_numeric_features:
        _add_unique_suggestion(
            suggestions,
            {
                "action_type": "convert_type",
                "columns": non_numeric_features,
                "params": {"columns": non_numeric_features, "target": "numeric"},
                "reason": "Linear regression requires numeric feature columns.",
                "severity": "blocking",
            },
        )


def _check_logistic_regression(df: pd.DataFrame, target_column: str, issues: list, suggestions: list) -> None:
    """Run logistic regression readiness checks."""
    target_series = df[target_column].dropna()
    unique_count = target_series.nunique()
    if unique_count < 2:
        issues.append(
            _build_issue(
                f"Target column '{target_column}' has fewer than two distinct values; logistic regression needs categories.",
                "blocking",
            )
        )
    if _column_is_numeric(df[target_column]) and unique_count > 20:
        issues.append(
            _build_issue(
                f"Target column '{target_column}' appears continuous ({unique_count} unique values).",
                "warning",
            )
        )
    if not _column_is_numeric(df[target_column]):
        issues.append(
            _build_issue(
                f"Target column '{target_column}' is categorical and should be encoded for logistic regression.",
                "blocking",
            )
        )
        _add_unique_suggestion(
            suggestions,
            {
                "action_type": "convert_type",
                "columns": [target_column],
                "params": {"columns": [target_column], "target": "numeric"},
                "reason": "Logistic regression requires an encoded numeric target column.",
                "severity": "blocking",
            },
        )

    feature_columns = [col for col in df.columns if col != target_column]
    categorical_features = [col for col in feature_columns if not _column_is_numeric(df[col])]
    for column in categorical_features:
        issues.append(
            _build_issue(
                f"Feature column '{column}' is categorical and should be encoded before logistic regression.",
                "blocking",
            )
        )
    if categorical_features:
        _add_unique_suggestion(
            suggestions,
            {
                "action_type": "convert_type",
                "columns": categorical_features,
                "params": {"columns": categorical_features, "target": "numeric"},
                "reason": "Logistic regression expects numeric feature columns.",
                "severity": "blocking",
            },
        )


def _check_kmeans(df: pd.DataFrame, issues: list, suggestions: list) -> None:
    """Run k-means clustering readiness checks."""
    non_numeric_columns = [col for col in df.columns if not _column_is_numeric(df[col])]
    for column in non_numeric_columns:
        issues.append(
            _build_issue(
                f"Column '{column}' is not numeric. K-means requires numeric features.",
                "blocking",
            )
        )
    if non_numeric_columns:
        _add_unique_suggestion(
            suggestions,
            {
                "action_type": "convert_type",
                "columns": non_numeric_columns,
                "params": {"columns": non_numeric_columns, "target": "numeric"},
                "reason": "K-means requires numeric feature columns.",
                "severity": "blocking",
            },
        )
    issues.append(
        _build_issue(
            "Consider scaling numeric features before clustering to reduce feature dominance.",
            "info",
        )
    )


@ml_prep_bp.route('/models', methods=['GET'])
def get_available_models():
    """Return supported ML models for UI dropdowns."""
    return jsonify({"models": MODEL_DEFINITIONS}), 200


@ml_prep_bp.route('/check', methods=['POST'])
def check_dataset_readiness():
    """Analyze dataset readiness for a given model type."""
    payload = request.json or {}
    model_type = payload.get('model_type')
    target_column = payload.get('target_column')

    if not model_type or model_type not in MODEL_LOOKUP:
        return jsonify({"error": "Invalid or missing model_type."}), 400

    df = _get_dataset()
    if df is None or not isinstance(df, pd.DataFrame):
        return jsonify({"error": "No dataset available. Upload data first."}), 400

    if model_type in {"linear_regression", "logistic_regression"}:
        if not target_column:
            return jsonify({"error": "target_column is required for the selected model."}), 400
        if target_column not in df.columns:
            return jsonify({"error": f"Target column '{target_column}' does not exist."}), 400

    issues = []
    suggestions = []

    feature_columns = [col for col in df.columns if col != target_column]

    _check_missing_values(df, issues, suggestions)
    _check_mixed_types(df, issues, suggestions)
    _check_row_feature_ratio(df, len(feature_columns), issues, suggestions)

    if model_type == "linear_regression":
        _check_linear_regression(df, target_column, issues, suggestions)
    elif model_type == "logistic_regression":
        _check_logistic_regression(df, target_column, issues, suggestions)
    elif model_type == "kmeans":
        _check_kmeans(df, issues, suggestions)

    ready = not any(issue.get("severity") == "blocking" for issue in issues)
    return jsonify({"ready": ready, "issues": issues, "suggestions": suggestions}), 200


@ml_prep_bp.route('/train', methods=['POST'])
def train_dataset_model():
    """Train the selected model on prepared data and return metrics/predictions."""
    payload = request.json or {}
    model_type = payload.get('model_type')
    target_column = payload.get('target_column')
    n_clusters = payload.get('n_clusters')
    feature_columns = payload.get('feature_columns')

    if not model_type or model_type not in MODEL_LOOKUP:
        return jsonify({"error": "Invalid or missing model_type."}), 400

    if n_clusters is not None:
        try:
            n_clusters = int(n_clusters)
        except (TypeError, ValueError):
            return jsonify({"error": "n_clusters must be an integer."}), 400

    df = _dataset_from_payload(payload)
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return jsonify({"error": "No dataset available. Upload or provide cleaned data first."}), 400

    try:
        request_data = TrainingRequest(
            dataset=df,
            model_type=model_type,
            target_column=target_column,
            n_clusters=n_clusters,
            feature_columns=feature_columns,
        )
        results = train_model(request_data)
    except ModelTrainingError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"Unexpected training error: {exc}"}), 500

    return jsonify(results), 200
