from flask import Blueprint, jsonify, request

from backend.services.data_catalog_lineage import evaluate_dataset_readiness, governance_error_payload, is_blocked
from backend.services.semantic_model import infer_semantic_model_from_dataframe
from backend.utils.global_state import (
    get_governance_policy,
    get_semantic_model,
    get_uploaded_df,
    set_cleaned_data,
    set_governance_state,
    set_semantic_model,
)

cleaning_bp = Blueprint('cleaning_bp', __name__, url_prefix='/api')


@cleaning_bp.route('/cleaning', methods=['POST'])
def get_clean():
    uploaded_df = get_uploaded_df()
    if uploaded_df is None:
        return jsonify({'error': 'No file has been uploaded yet'}), 400

    try:
        data = request.json
        task = data.get('task', '')

        if task == 'remove_nulls':
            cleaned_df = uploaded_df.dropna()
        elif task == 'fill_nulls':
            fill_value = data.get('fill_value', '')
            cleaned_df = uploaded_df.fillna(fill_value)
        elif task == 'standardize':
            cleaned_df = uploaded_df.applymap(lambda x: x.lower() if isinstance(x, str) else x)
        else:
            return jsonify({'error': 'Invalid cleaning task'}), 400

        readiness = evaluate_dataset_readiness(cleaned_df, get_governance_policy(), operation='cleaning')
        if is_blocked(readiness):
            return jsonify(governance_error_payload(readiness)), 422

        set_cleaned_data(cleaned_df)
        set_governance_state(readiness['policy'], readiness)
        semantic_model = infer_semantic_model_from_dataframe(
            cleaned_df,
            source='basic_cleaning',
            existing_model=get_semantic_model(),
            preserve_user_metrics=True,
        )
        set_semantic_model(semantic_model)

        cleaned_preview = cleaned_df.head(10).to_dict(orient='records')
        cleaned_data = cleaned_df.to_dict(orient='records')

        return jsonify({
            'message': 'Cleaning task completed successfully',
            'cleaned_preview': cleaned_preview,
            'cleaned_data': cleaned_data,
            'semantic_model': semantic_model,
            'governance_readiness': readiness,
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to clean data: {str(e)}'}), 500


@cleaning_bp.route('/bypass_cleaning', methods=['POST'])
def bypass_cleaning():
    uploaded_df = get_uploaded_df()
    if uploaded_df is None:
        return jsonify({'error': 'No file has been uploaded yet'}), 400

    try:
        cleaned_df = uploaded_df
        readiness = evaluate_dataset_readiness(cleaned_df, get_governance_policy(), operation='bypass_cleaning')
        if is_blocked(readiness):
            return jsonify(governance_error_payload(readiness)), 422

        set_cleaned_data(cleaned_df)
        set_governance_state(readiness['policy'], readiness)
        semantic_model = infer_semantic_model_from_dataframe(
            cleaned_df,
            source='bypass_cleaning',
            existing_model=get_semantic_model(),
            preserve_user_metrics=True,
        )
        set_semantic_model(semantic_model)

        cleaned_preview = cleaned_df.head(10).to_dict(orient='records')
        cleaned_data = cleaned_df.to_dict(orient='records')

        return jsonify({
            'message': 'Bypassed cleaning. Data is considered cleaned as is.',
            'cleaned_preview': cleaned_preview,
            'cleaned_data': cleaned_data,
            'semantic_model': semantic_model,
            'governance_readiness': readiness,
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to bypass cleaning: {str(e)}'}), 500
