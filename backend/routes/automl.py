from flask import Blueprint, jsonify, request
import pandas as pd
from backend.utils.global_state import get_cleaned_data, get_uploaded_df
from backend.services.automl_logic import AutoMLService
from backend.services.model_training import ModelTrainingError

automl_bp = Blueprint('automl_bp', __name__, url_prefix='/api/automl')

def _get_dataset():
    """Return the cleaned dataset if available, otherwise fall back to the upload."""
    return get_cleaned_data() or get_uploaded_df()

@automl_bp.route('/train', methods=['POST'])
def train_automl():
    """
    Endpoint to trigger AutoML training.
    Expects JSON payload with:
    - target_column: The column to predict.
    - test_size: (Optional) Ratio for test split.
    """
    payload = request.json or {}
    target_column = payload.get('target_column')
    test_size = payload.get('test_size', 0.2)

    if not target_column:
        return jsonify({"error": "target_column is required."}), 400

    df = _get_dataset()
    if df is None or df.empty:
        return jsonify({"error": "No dataset available. Please upload a dataset first."}), 400

    if target_column not in df.columns:
        return jsonify({"error": f"Target column '{target_column}' not found in dataset."}), 400

    try:
        results = AutoMLService.train_automl(df, target_column, test_size=test_size)
        return jsonify(results), 200
    except ModelTrainingError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500
