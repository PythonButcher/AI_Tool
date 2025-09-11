from flask import Blueprint, request, jsonify
import pandas as pd
import json

raw_data_bp = Blueprint("raw_data_bp", __name__, url_prefix="/api")

@raw_data_bp.route("/raw_upload", methods=["POST"])
def raw_upload():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

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
            return jsonify({"error": "Unsupported file type"}), 400

        return jsonify({ "raw_data": df.to_dict(orient="records") })

    except Exception as e:
        return jsonify({ "error": f"Failed to parse raw data: {str(e)}" }), 500
