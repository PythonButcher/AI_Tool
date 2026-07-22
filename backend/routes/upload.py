from flask import Blueprint, jsonify, request
from io import BytesIO
import json
import logging

from backend.services.dataset_context import read_dataset_file
from backend.services.data_catalog_lineage import (
    GovernancePolicyError,
    evaluate_dataset_readiness,
    governance_error_payload,
    is_blocked,
    normalize_governance_policy,
)
from backend.services.semantic_model import infer_semantic_model_from_dataframe
from backend.services.workspace_context import register_managed_upload
from backend.utils.global_state import set_governance_state, set_semantic_model, set_uploaded_df

logger = logging.getLogger(__name__)

upload_bp = Blueprint('upload_bp', __name__, url_prefix='/api')


@upload_bp.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # Read the request body once. Parsing and managed persistence both use
        # these server-received bytes; no client path is accepted or trusted.
        file_bytes = file.stream.read()
        df = read_dataset_file(BytesIO(file_bytes), filename=file.filename)
        raw_policy = request.form.get('governance_policy') or request.form.get('governancePolicy')
        policy = normalize_governance_policy(json.loads(raw_policy) if raw_policy else None)
        readiness = evaluate_dataset_readiness(df, policy, operation='upload')
        if is_blocked(readiness):
            return jsonify(governance_error_payload(readiness)), 422

        semantic_model = infer_semantic_model_from_dataframe(df, dataset_name=file.filename, source='upload')

        numeric_summary = df.select_dtypes(include='number').sum().to_dict()
        categorical_summary = (
            df.select_dtypes(exclude='number')
            .apply(lambda x: x.value_counts().to_dict())
            .to_dict()
        )
        data_preview = json.loads(df.head().to_json(orient='records', date_format='iso'))
        full_data = json.loads(df.to_json(orient='records', date_format='iso'))
        registered = register_managed_upload(
            file_bytes=file_bytes,
            filename=file.filename,
            dataframe=df,
            semantic_model=semantic_model,
            governance_policy=policy,
            governance_readiness=readiness,
            preview=data_preview,
        )
        semantic_model = registered['source']['semantic_model']

        # Preserve the process-global state only as a compatibility mirror for
        # current single-dataset consumers. Durable records are authoritative.
        set_uploaded_df(df)
        set_governance_state(policy, readiness)
        set_semantic_model(semantic_model)

        return jsonify({
            'message': f"File '{file.filename}' uploaded successfully!",
            'data_preview': data_preview,
            'full_data': full_data,
            'numeric_summary': numeric_summary,
            'categorical_summary': categorical_summary,
            'semantic_model': semantic_model,
            'governance_readiness': readiness,
            'source': registered['source'],
            'workspace': registered['workspace'],
            'analysis_context': registered['analysis_context'],
        }), 200

    except (json.JSONDecodeError, GovernancePolicyError) as e:
        return jsonify({'error': f'Invalid governance policy: {str(e)}'}), 400
    except Exception as e:
        logger.exception("Failed to process uploaded file %s", file.filename)
        return jsonify({'error': f'Failed to process the file: {str(e)}'}), 500
