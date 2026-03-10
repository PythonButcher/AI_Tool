from flask import Blueprint, jsonify, request
import json

import pandas as pd

from backend.services.semantic_model import infer_semantic_model_from_dataframe
from backend.utils.global_state import set_semantic_model, set_uploaded_df


upload_bp = Blueprint('upload_bp', __name__, url_prefix='/api')


@upload_bp.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file)
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(file)
        elif file.filename.endswith('.json'):
            df = pd.read_json(file)
        elif file.filename.endswith('.geojson'):
            geojson_obj = json.load(file)
            df = pd.json_normalize(geojson_obj['features'])
        else:
            return jsonify({'error': 'Unsupported file type'}), 400

        set_uploaded_df(df)
        semantic_model = infer_semantic_model_from_dataframe(df, dataset_name=file.filename, source='upload')
        set_semantic_model(semantic_model)

        numeric_summary = df.select_dtypes(include='number').sum().to_dict()
        categorical_summary = (
            df.select_dtypes(exclude='number')
            .apply(lambda x: x.value_counts().to_dict())
            .to_dict()
        )
        data_preview = df.head().to_json(orient='records')
        full_data = df.to_dict(orient='records')

        return jsonify({
            'message': f"File '{file.filename}' uploaded successfully!",
            'data_preview': data_preview,
            'full_data': full_data,
            'numeric_summary': numeric_summary,
            'categorical_summary': categorical_summary,
            'semantic_model': semantic_model,
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to process the file: {str(e)}'}), 500
