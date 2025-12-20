from flask import Blueprint, jsonify, request
import sqlite3
import json
from datetime import datetime
from backend.db.backend_db import get_db_connection  # must exist in your project

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


# -----------------------------
# POST /api/datahub/fetch_rows
# -----------------------------
@datahub_bp.route('/fetch_rows', methods=['POST'])
def fetch_dataset_rows():
    """
    Accepts { "dataset_ids": ["id_1", "id_2"] }
    Returns { "datasets": { "id_1": [...records], "id_2": [...records] } }
    """
    try:
        data = request.get_json(force=True)
        dataset_ids = data.get("dataset_ids", [])
        
        if not dataset_ids:
            return jsonify({'datasets': {}}), 200

        # 1. Resolve IDs to paths
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        
        # Safe way to query multiple IDs
        placeholders = ','.join('?' for _ in dataset_ids)
        query = f'SELECT id, path FROM datahub_datasets WHERE id IN ({placeholders})'
        rows = conn.execute(query, dataset_ids).fetchall()
        conn.close()

        # Create map of id -> path
        id_to_path = { row['id']: row['path'] for row in rows }

        results = {}
        import pandas as pd # Import locally to avoid circle if helper used, though standard import is fine

        for d_id in dataset_ids:
            path = id_to_path.get(d_id)
            if not path:
                results[d_id] = {"error": "Dataset not found in warehouse"}
                continue
            
            # 2. Load data (Reuse logic similar to raw_upload)
            try:
                # Basic file reading logic - can be extracted to a helper if needed
                # Remove potential surrounding quotes from the path string
                path = path.strip('"').strip("'")
                lower_path = path.lower()
                if lower_path.endswith('.csv'):
                    df = pd.read_csv(path)
                elif lower_path.endswith(('.xls', '.xlsx')):
                    df = pd.read_excel(path)
                elif lower_path.endswith('.json'):
                    df = pd.read_json(path)
                elif lower_path.endswith('.geojson'):
                    with open(path, 'r') as f:
                        geojson_obj = json.load(f)
                    df = pd.json_normalize(geojson_obj['features'])
                else:
                    results[d_id] = {"error": "Unsupported file format"}
                    continue
                
                # Convert to dict
                # Limit to 100 rows for now to prevent token overflow, can be adjusted
                # Or we can send everything and let the AI logic truncate.
                # User constraint: "Avoid sending unnecessary data to the AI; if datasets are large, propose summarization or truncation strategies."
                # Strategy: We'll send first 100 rows + summary stats if larger? 
                # For now, let's just send the head(100) to be safe and responsive.
                
                MAX_ROWS = 100
                truncated = False
                if len(df) > MAX_ROWS:
                    df = df.head(MAX_ROWS)
                    truncated = True
                
                records = df.to_dict(orient="records")
                results[d_id] = {
                    "data": records,
                    "truncated": truncated,
                    "row_count": len(records) # count of what we are sending
                }

            except Exception as e:
                results[d_id] = {"error": f"Failed to read file: {str(e)}"}

        return jsonify({'datasets': results}), 200

    except Exception as e:
        return jsonify({'error': f"Internal error fetching rows: {str(e)}"}), 500
