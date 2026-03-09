from flask import Blueprint, request, jsonify, make_response
import requests
import pandas as pd

from backend.services.semantic_model import infer_semantic_model_from_dataframe
from backend.utils.global_state import set_semantic_model, set_uploaded_df


def flatten_dict(d, parent_key='', sep='_'):
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list) and all(isinstance(i, (str, int, float)) for i in v):
            items.append((new_key, ', '.join(map(str, v))))
        elif isinstance(v, (str, int, float)):
            items.append((new_key, v))
        else:
            items.append((new_key, 'Unsupported Type'))
    return dict(items)


api_fetch_bp = Blueprint('api_fetch_bp', __name__)


@api_fetch_bp.route('/api/fetch_external_data', methods=['OPTIONS'])
def handle_options():
    response = make_response()
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response, 204


@api_fetch_bp.route('/api/fetch_external_data', methods=['POST'])
def fetch_external_data():
    try:
        data = request.json
        api_url = data.get('api_url')

        if not api_url:
            return jsonify({'error': 'API URL is required'}), 400

        response = requests.get(api_url)
        response.raise_for_status()

        raw_data = response.json()
        cleaned_data = raw_data if isinstance(raw_data, list) else [raw_data]

        dataframe = pd.DataFrame(cleaned_data)
        set_uploaded_df(dataframe)
        semantic_model = infer_semantic_model_from_dataframe(
            dataframe,
            dataset_name=api_url,
            source='external_api',
        )
        set_semantic_model(semantic_model)

        return jsonify({
            'data_preview': cleaned_data[:5],
            'full_data': cleaned_data,
            'semantic_model': semantic_model,
        }), 200
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Request error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500
