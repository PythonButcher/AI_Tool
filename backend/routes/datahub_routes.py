from datetime import datetime
import json
import sqlite3

from flask import Blueprint, jsonify, request

from backend.db.backend_db import get_db_connection
from backend.services.dataset_context import read_dataset_file
from backend.services.semantic_model import infer_semantic_model_from_dataframe


datahub_bp = Blueprint('datahub_bp', __name__, url_prefix='/api/datahub')


def _deserialize_dataset_record(row):
    record = dict(row)
    if record.get('schema_json'):
        record['schema'] = json.loads(record['schema_json'])
    if record.get('preview_json'):
        record['preview'] = json.loads(record['preview_json'])
    if record.get('semantic_model_json'):
        record['semantic_model'] = json.loads(record['semantic_model_json'])
    record.pop('schema_json', None)
    record.pop('preview_json', None)
    record.pop('semantic_model_json', None)
    return record

@datahub_bp.route('/list', methods=['GET'])
def get_all_datasets():
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT * FROM datahub_datasets').fetchall()
    conn.close()

    datasets = [_deserialize_dataset_record(row) for row in rows]
    return jsonify(datasets), 200


@datahub_bp.route('/<dataset_id>', methods=['GET'])
def get_dataset(dataset_id):
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    row = conn.execute('SELECT * FROM datahub_datasets WHERE id = ?', (dataset_id,)).fetchone()
    conn.close()

    if row is None:
        return jsonify({'error': 'Dataset not found'}), 404

    return jsonify(_deserialize_dataset_record(row)), 200


@datahub_bp.route('/register', methods=['POST'])
def register_dataset():
    try:
        data = request.get_json(force=True)

        dataset_id = data.get('id')
        name = data.get('name')
        path = data.get('path')

        if not all([dataset_id, name, path]):
            return jsonify({'error': 'Missing required fields: id, name, path'}), 400

        uploaded_at = data.get('uploadedAt', datetime.utcnow().isoformat())
        num_rows = data.get('numRows', 0)
        num_cols = data.get('numCols', 0)
        schema = data.get('schema', [])
        preview = data.get('preview', [])
        semantic_model = data.get('semantic_model') or data.get('semanticModel')

        conn = get_db_connection()
        conn.execute(
            '''
            INSERT INTO datahub_datasets
            (id, name, path, uploadedAt, numRows, numCols, schema_json, preview_json, semantic_model_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                path = excluded.path,
                uploadedAt = excluded.uploadedAt,
                numRows = excluded.numRows,
                numCols = excluded.numCols,
                schema_json = excluded.schema_json,
                preview_json = excluded.preview_json,
                semantic_model_json = COALESCE(excluded.semantic_model_json, datahub_datasets.semantic_model_json)
            ''',
            (
                dataset_id,
                name,
                path,
                uploaded_at,
                num_rows,
                num_cols,
                json.dumps(schema),
                json.dumps(preview),
                json.dumps(semantic_model) if semantic_model else None,
            ),
        )
        conn.commit()
        conn.close()

        return jsonify({'message': 'Dataset registered successfully'}), 201

    except Exception as e:
        return jsonify({'error': f'Failed to register dataset: {str(e)}'}), 500


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


@datahub_bp.route('/<dataset_id>/semantic-model', methods=['GET'])
def get_dataset_semantic_model(dataset_id):
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        'SELECT id, name, path, semantic_model_json FROM datahub_datasets WHERE id = ?',
        (dataset_id,),
    ).fetchone()
    conn.close()

    if row is None:
        return jsonify({'error': 'Dataset not found'}), 404

    if row['semantic_model_json']:
        return jsonify({'semantic_model': json.loads(row['semantic_model_json'])}), 200

    try:
        dataframe = read_dataset_file(row['path'])
    except Exception as exc:
        return jsonify({'error': f'Unable to infer semantic model: {exc}'}), 500

    semantic_model = infer_semantic_model_from_dataframe(
        dataframe,
        dataset_name=row['name'],
        dataset_id=row['id'],
        source='datahub_inferred',
    )

    conn = get_db_connection()
    conn.execute(
        'UPDATE datahub_datasets SET semantic_model_json = ? WHERE id = ?',
        (json.dumps(semantic_model), dataset_id),
    )
    conn.commit()
    conn.close()

    return jsonify({'semantic_model': semantic_model}), 200


@datahub_bp.route('/<dataset_id>/semantic-model', methods=['PUT'])
def update_dataset_semantic_model(dataset_id):
    payload = request.get_json(force=True) or {}
    semantic_model = payload.get('semantic_model') or payload.get('semanticModel') or payload

    if not isinstance(semantic_model, dict):
        return jsonify({'error': 'semantic_model must be a JSON object.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'UPDATE datahub_datasets SET semantic_model_json = ? WHERE id = ?',
        (json.dumps(semantic_model), dataset_id),
    )
    conn.commit()
    updated = cursor.rowcount
    conn.close()

    if updated == 0:
        return jsonify({'error': 'Dataset not found'}), 404

    return jsonify({'message': 'Semantic model updated successfully', 'semantic_model': semantic_model}), 200


@datahub_bp.route('/fetch_rows', methods=['POST'])
def fetch_dataset_rows():
    try:
        data = request.get_json(force=True)
        dataset_ids = data.get('dataset_ids', [])

        if not dataset_ids:
            return jsonify({'datasets': {}}), 200

        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        placeholders = ','.join('?' for _ in dataset_ids)
        query = (
            'SELECT id, name, path, semantic_model_json '
            f'FROM datahub_datasets WHERE id IN ({placeholders})'
        )
        rows = conn.execute(query, dataset_ids).fetchall()
        conn.close()

        id_to_record = {
            row['id']: {
                'name': row['name'],
                'path': row['path'],
                'semantic_model': json.loads(row['semantic_model_json']) if row['semantic_model_json'] else None,
            }
            for row in rows
        }

        results = {}
        for dataset_id in dataset_ids:
            record = id_to_record.get(dataset_id)
            if not record:
                results[dataset_id] = {'error': 'Dataset not found in warehouse'}
                continue

            try:
                dataframe = read_dataset_file(record['path'])
                semantic_model = record['semantic_model'] or infer_semantic_model_from_dataframe(
                    dataframe,
                    dataset_name=record['name'],
                    dataset_id=dataset_id,
                    source='datahub_fetch_rows',
                )

                if record['semantic_model'] is None:
                    conn = get_db_connection()
                    conn.execute(
                        'UPDATE datahub_datasets SET semantic_model_json = ? WHERE id = ?',
                        (json.dumps(semantic_model), dataset_id),
                    )
                    conn.commit()
                    conn.close()

                max_rows = 100
                truncated = False
                if len(dataframe) > max_rows:
                    dataframe = dataframe.head(max_rows)
                    truncated = True

                records = dataframe.to_dict(orient='records')
                results[dataset_id] = {
                    'data': records,
                    'truncated': truncated,
                    'row_count': len(records),
                    'semantic_model': semantic_model,
                }
            except Exception as e:
                results[dataset_id] = {'error': f'Failed to read file: {str(e)}'}

        return jsonify({'datasets': results}), 200

    except Exception as e:
        return jsonify({'error': f'Internal error fetching rows: {str(e)}'}), 500
