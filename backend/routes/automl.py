from flask import Blueprint, jsonify, request
import pandas as pd

from backend.services.data_catalog_lineage import (
    GovernancePolicyError,
    evaluate_dataset_readiness,
    governance_error_payload,
    is_blocked,
)
from backend.utils.global_state import get_cleaned_data, get_uploaded_df
from backend.utils.global_state import get_governance_policy


automl_bp = Blueprint('automl_bp', __name__, url_prefix='/api/automl')


def _get_dataset():
    """Return cleaned dataset when present; otherwise fall back to uploaded data."""
    cleaned = get_cleaned_data()
    if cleaned is not None:
        return cleaned
    return get_uploaded_df()


def _dataset_from_payload(payload: dict):
    payload_dataset = payload.get('dataset')
    if payload_dataset is None:
        return _get_dataset()

    if isinstance(payload_dataset, list):
        return pd.DataFrame(payload_dataset)
    if isinstance(payload_dataset, dict):
        return pd.DataFrame.from_dict(payload_dataset)

    raise ValueError('dataset must be a list of row objects or a column mapping.')


def _resolve_column_name(df: pd.DataFrame, requested: str):
    if requested in df.columns:
        return requested
    normalized = {str(col).strip().lower(): col for col in df.columns}
    return normalized.get(str(requested).strip().lower())


@automl_bp.route('/train', methods=['POST'])
def train_automl():
    """
    Endpoint to trigger AutoML training.
    Expects JSON payload with:
    - target_column: The column used as the target for a local train/test evaluation.
    - test_size: (Optional) Ratio for test split.
    - dataset: (Optional) dataset payload from frontend state.
    """
    payload = request.json or {}
    target_column = payload.get('target_column')
    test_size = payload.get('test_size', 0.2)

    if not target_column:
        return jsonify({"error": "target_column is required."}), 400

    try:
        df = _dataset_from_payload(payload)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return jsonify({"error": "No dataset available. Please upload a dataset first."}), 400

    try:
        readiness = evaluate_dataset_readiness(
            df,
            payload.get('governance_policy') or payload.get('governancePolicy') or get_governance_policy(),
            operation='automl',
        )
    except GovernancePolicyError as e:
        return jsonify({"error": f"Invalid governance policy: {e}"}), 400
    if is_blocked(readiness):
        return jsonify(governance_error_payload(readiness)), 422

    resolved_target = _resolve_column_name(df, target_column)
    if resolved_target is None:
        return jsonify({"error": f"Target column '{target_column}' not found in dataset."}), 400

    try:
        # Import only after the governance gate. Invalid data should never
        # trigger model-library loading or a training attempt.
        from backend.services.automl_logic import AutoMLService
        results = AutoMLService.train_automl(df, resolved_target, test_size=test_size)
        results['governance_readiness'] = readiness
        return jsonify(results), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500
