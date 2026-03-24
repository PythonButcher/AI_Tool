from flask import Blueprint, request, jsonify
import json
import logging

from backend.services.dataset_context import read_dataset_file

logger = logging.getLogger(__name__)

raw_data_bp = Blueprint("raw_data_bp", __name__, url_prefix="/api")

@raw_data_bp.route("/raw_upload", methods=["POST"])
def raw_upload():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        df = read_dataset_file(file, filename=file.filename)

        raw_data = json.loads(df.to_json(orient="records", date_format="iso"))
        return jsonify({ "raw_data": raw_data })

    except Exception as e:
        logger.exception("Failed to parse raw upload file %s", file.filename)
        return jsonify({ "error": f"Failed to parse raw data: {str(e)}" }), 500
