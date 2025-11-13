from flask import Blueprint, jsonify, request
import sqlite3
import json
from datetime import datetime
from backend.backend_db import get_db_connection  # must exist in your project

datahub_bp = Blueprint("datahub_bp", __name__, url_prefix="/api/datahub")


# -----------------------------
# GET /api/datahub/list
# -----------------------------
@datahub_bp.route('/list', methods=['GET'])
def get_all_datasets():
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT * FROM datahub_datasets').fetchall()
    conn.close()

    datasets = []
    for row in rows:
        record = dict(row)
        # Parse JSON fields back into Python structures
        if record.get("schema_json"):
            record["schema"] = json.loads(record["schema_json"])
        if record.get("preview_json"):
            record["preview"] = json.loads(record["preview_json"])
        record.pop("schema_json", None)
        record.pop("preview_json", None)
        datasets.append(record)

    return jsonify(datasets), 200


# -----------------------------
# GET /api/datahub/<dataset_id>
# -----------------------------
@datahub_bp.route('/<dataset_id>', methods=['GET'])
def get_dataset(dataset_id):
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    row = conn.execute('SELECT * FROM datahub_datasets WHERE id = ?', (dataset_id,)).fetchone()
    conn.close()

    if row is None:
        return jsonify({'error': 'Dataset not found'}), 404

    record = dict(row)
    if record.get("schema_json"):
        record["schema"] = json.loads(record["schema_json"])
    if record.get("preview_json"):
        record["preview"] = json.loads(record["preview_json"])
    record.pop("schema_json", None)
    record.pop("preview_json", None)

    return jsonify(record), 200


# -----------------------------
# POST /api/datahub/register
# -----------------------------
@datahub_bp.route('/register', methods=['POST'])
def register_dataset():
    try:
        data = request.get_json(force=True)

        # Required core fields
        dataset_id = data.get("id")
        name = data.get("name")
        path = data.get("path")

        if not all([dataset_id, name, path]):
            return jsonify({'error': 'Missing required fields: id, name, path'}), 400

        uploadedAt = data.get("uploadedAt", datetime.utcnow().isoformat())
        numRows = data.get("numRows", 0)
        numCols = data.get("numCols", 0)
        schema = data.get("schema", [])
        preview = data.get("preview", [])

        conn = get_db_connection()
        conn.execute(
            '''
            INSERT INTO datahub_datasets
            (id, name, path, uploadedAt, numRows, numCols, schema_json, preview_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                dataset_id,
                name,
                path,
                uploadedAt,
                numRows,
                numCols,
                json.dumps(schema),
                json.dumps(preview)
            )
        )
        conn.commit()
        conn.close()

        return jsonify({'message': 'Dataset registered successfully'}), 201

    except Exception as e:
        return jsonify({'error': f'Failed to register dataset: {str(e)}'}), 500


# -----------------------------
# DELETE /api/datahub/<dataset_id>
# -----------------------------
@datahub_bp.route('/<dataset_id>', methods=['DELETE'])
def delete_dataset(dataset_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM datahub_datasets WHERE id = ?', (dataset_id,))
    conn.commit()
    deleted = cursor.rowcount
    conn.close()

    if deleted == 0:
        return jsonify({'error': 'Dataset not found'}), 404

    return jsonify({'message': 'Dataset deleted successfully'}), 200
