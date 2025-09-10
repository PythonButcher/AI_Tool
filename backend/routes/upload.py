# backend/routes/upload.py
from flask import Blueprint, jsonify, request
import pandas as pd
from backend.global_state import set_uploaded_df
import json


upload_bp = Blueprint('upload_bp', __name__, url_prefix='/api')

@upload_bp.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # Load file into a DataFrame
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

        # Save DataFrame to global state
        set_uploaded_df(df)

        # Prepare summaries and preview
        numeric_summary = df.select_dtypes(include='number').sum().to_dict()
        categorical_summary = df.select_dtypes(exclude='number').apply(lambda x: x.value_counts().to_dict()).to_dict()
        data_preview = df.head().to_json(orient='records')
         

        return jsonify({
            "message": f"File '{file.filename}' uploaded successfully!",
            "data_preview": data_preview,
            "numeric_summary": numeric_summary,
            "categorical_summary": categorical_summary
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to process the file: {str(e)}"}), 500
