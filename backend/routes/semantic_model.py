from flask import Blueprint, jsonify, request
import pandas as pd

from backend.services.semantic_model import (
    infer_semantic_model_from_dataframe,
    normalize_records,
)
from backend.utils.global_state import (
    get_cleaned_data,
    get_semantic_model,
    get_uploaded_df,
    set_semantic_model,
)

semantic_model_bp = Blueprint('semantic_model_bp', __name__, url_prefix='/api/semantic-model')


def _resolve_active_dataframe():
    cleaned = get_cleaned_data()
    if isinstance(cleaned, pd.DataFrame) and not cleaned.empty:
        return cleaned

    uploaded = get_uploaded_df()
    if isinstance(uploaded, pd.DataFrame):
        return uploaded

    return None


@semantic_model_bp.route('/infer', methods=['POST'])
def infer_semantic_model_route():
    payload = request.get_json(silent=True) or {}
    dataset = payload.get('dataset')
    dataset_name = payload.get('dataset_name')
    dataset_id = payload.get('dataset_id')
    persist_current = payload.get('persist_current', True)
    source = payload.get('source', 'inferred')

    if dataset is not None:
        records = normalize_records(dataset)
        if not records:
            return jsonify({'error': 'A valid dataset is required to infer a semantic model.'}), 400
        dataframe = pd.DataFrame(records)
    else:
        dataframe = _resolve_active_dataframe()
        if dataframe is None or dataframe.empty:
            return jsonify({'error': 'No dataset is currently available.'}), 400

    semantic_model = infer_semantic_model_from_dataframe(
        dataframe,
        dataset_name=dataset_name,
        dataset_id=dataset_id,
        source=source,
    )

    if persist_current:
        set_semantic_model(semantic_model)

    return jsonify({'semantic_model': semantic_model}), 200


@semantic_model_bp.route('/current', methods=['GET'])
def get_current_semantic_model_route():
    semantic_model = get_semantic_model()
    if semantic_model is not None:
        return jsonify({'semantic_model': semantic_model}), 200

    dataframe = _resolve_active_dataframe()
    if dataframe is None or dataframe.empty:
        return jsonify({'error': 'No semantic model is available yet.'}), 404

    inferred = infer_semantic_model_from_dataframe(dataframe, source='current_inferred')
    set_semantic_model(inferred)
    return jsonify({'semantic_model': inferred}), 200


@semantic_model_bp.route('/current', methods=['PUT'])
def set_current_semantic_model_route():
    payload = request.get_json(silent=True) or {}
    semantic_model = payload.get('semantic_model') or payload

    if not isinstance(semantic_model, dict):
        return jsonify({'error': 'semantic_model must be a JSON object.'}), 400

    set_semantic_model(semantic_model)
    return jsonify({'semantic_model': semantic_model, 'message': 'Semantic model updated.'}), 200
