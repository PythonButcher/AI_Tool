"""ML prep readiness checks for datasets.

This module exposes endpoints that analyze the current dataset and
return actionable feedback before users run ML workflows.
"""

from flask import Blueprint, jsonify, request
import pandas as pd
from backend.utils.global_state import get_cleaned_data, get_uploaded_df

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


def _add_unique(items, new_item):
    if new_item not in items:
        items.append(new_item)


def _check_missing_values(df: pd.DataFrame, issues: list, suggestions: list) -> None:
    """Identify missing values and recommend cleaning actions."""
    missing_counts = df.isna().sum()
    total_rows = len(df)
    for column, count in missing_counts[missing_counts > 0].items():
        percentage = (count / total_rows * 100) if total_rows else 0
        issues.append(
            f"Column '{column}' contains {percentage:.1f}% missing values ({count} rows)."
        )
    if (missing_counts > 0).any():
        _add_unique(
            suggestions,
            "Use Replace Nulls or Remove Nulls in Data Cleaning to address missing data.",
        )


def _check_mixed_types(df: pd.DataFrame, issues: list, suggestions: list) -> None:
    """Warn about columns with mixed numeric/text types."""
    for column in df.columns:
        if _column_has_mixed_numeric_text(df[column]):
            issues.append(
                f"Column '{column}' contains mixed numeric and text values."
            )
    if any("mixed numeric" in issue for issue in issues):
        _add_unique(
            suggestions,
            "Use Convert Type or Replace Values to normalize mixed-type columns.",
        )


def _check_row_feature_ratio(df: pd.DataFrame, feature_count: int, issues: list, suggestions: list) -> None:
    """Ensure dataset has enough rows relative to features."""
    if feature_count <= 0:
        return
    min_rows = feature_count * 5
    if len(df) < min_rows:
        issues.append(
            f"Dataset has {len(df)} rows for {feature_count} feature columns; aim for at least {min_rows} rows."
        )
        _add_unique(
            suggestions,
            "Consider collecting more data or reducing the number of feature columns.",
        )


def _check_linear_regression(df: pd.DataFrame, target_column: str, issues: list, suggestions: list) -> None:
    """Run linear regression readiness checks."""
    if not _column_is_numeric(df[target_column]):
        issues.append(
            f"Target column '{target_column}' is not fully numeric. Linear regression requires a numeric target."
        )
        _add_unique(
            suggestions,
            "Use Convert Type to cast the target column to numeric values.",
        )

    feature_columns = [col for col in df.columns if col != target_column]
    non_numeric_features = [col for col in feature_columns if not _column_is_numeric(df[col])]
    for column in non_numeric_features:
        issues.append(
            f"Feature column '{column}' is not numeric. Linear regression requires numeric features."
        )
    if non_numeric_features:
        _add_unique(
            suggestions,
            "Use Convert Type to cast feature columns to numeric values or encode categorical data.",
        )


def _check_logistic_regression(df: pd.DataFrame, target_column: str, issues: list, suggestions: list) -> None:
    """Run logistic regression readiness checks."""
    target_series = df[target_column].dropna()
    unique_count = target_series.nunique()
    if unique_count < 2:
        issues.append(
            f"Target column '{target_column}' has fewer than two distinct values; logistic regression needs categories."
        )
        _add_unique(
            suggestions,
            "Ensure the target column has at least two classes.",
        )
    if _column_is_numeric(df[target_column]) and unique_count > 20:
        issues.append(
            f"Target column '{target_column}' appears continuous ({unique_count} unique values)."
        )
        _add_unique(
            suggestions,
            "Consider binning the target or switching to linear regression.",
        )
    if not _column_is_numeric(df[target_column]):
        issues.append(
            f"Target column '{target_column}' is categorical and should be encoded for logistic regression."
        )
        _add_unique(
            suggestions,
            "Use Convert Type or label encoding to convert the target column to numeric classes.",
        )

    feature_columns = [col for col in df.columns if col != target_column]
    categorical_features = [col for col in feature_columns if not _column_is_numeric(df[col])]
    for column in categorical_features:
        issues.append(
            f"Feature column '{column}' is categorical and should be encoded before logistic regression."
        )
    if categorical_features:
        _add_unique(
            suggestions,
            "One-hot encode categorical feature columns before training logistic regression.",
        )


def _check_kmeans(df: pd.DataFrame, issues: list, suggestions: list) -> None:
    """Run k-means clustering readiness checks."""
    non_numeric_columns = [col for col in df.columns if not _column_is_numeric(df[col])]
    for column in non_numeric_columns:
        issues.append(
            f"Column '{column}' is not numeric. K-means requires numeric features."
        )
    if non_numeric_columns:
        _add_unique(
            suggestions,
            "Remove categorical columns or encode them before running k-means.",
        )
        _add_unique(
            suggestions,
            "Apply scaling (e.g., min-max normalization) to numeric features before clustering.",
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

    ready = len(issues) == 0
    return jsonify({"ready": ready, "issues": issues, "suggestions": suggestions}), 200
