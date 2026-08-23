from datetime import datetime
import json
import sqlite3

from flask import Blueprint, jsonify, request

from backend.db.backend_db import get_db_connection
from backend.services.data_catalog_lineage import (
    GovernancePolicyError,
    evaluate_dataset_readiness,
    governance_error_payload,
    is_blocked,
    normalize_governance_policy,
)
from backend.services.dataset_context import read_dataset_file
from backend.services.semantic_model import infer_semantic_model_from_dataframe
from backend.services.workspace_context import (
    WorkspaceContextError,
    delete_catalog_source,
)


datahub_bp = Blueprint('datahub_bp', __name__, url_prefix='/api/datahub')


def _deserialize_dataset_record(row):
    record = dict(row)
    if record.get('schema_json'):
        record['schema'] = json.loads(record['schema_json'])
    if record.get('preview_json'):
        record['preview'] = json.loads(record['preview_json'])
    if record.get('semantic_model_json'):
        record['semantic_model'] = json.loads(record['semantic_model_json'])
    if record.get('governance_policy_json'):
        record['governance_policy'] = json.loads(record['governance_policy_json'])
    if record.get('governance_readiness_json'):
        record['governance_readiness'] = json.loads(record['governance_readiness_json'])
    record.pop('schema_json', None)
    record.pop('preview_json', None)
    record.pop('semantic_model_json', None)
    record.pop('governance_policy_json', None)
    record.pop('governance_readiness_json', None)
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
        policy = normalize_governance_policy(data.get('governance_policy') or data.get('governancePolicy'))
        readiness = None
        try:
            readiness = evaluate_dataset_readiness(read_dataset_file(path), policy, operation='datahub_register')
        except Exception:
            # A catalogue registration can precede access to remote storage.
            # In that case, retain the policy and evaluate before any use.
            readiness = None

        conn = get_db_connection()
        conn.execute(
            '''
            INSERT INTO datahub_datasets
            (id, name, path, uploadedAt, numRows, numCols, schema_json, preview_json, semantic_model_json, governance_policy_json, governance_readiness_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                path = excluded.path,
                uploadedAt = excluded.uploadedAt,
                numRows = excluded.numRows,
                numCols = excluded.numCols,
                schema_json = excluded.schema_json,
                preview_json = excluded.preview_json,
                semantic_model_json = COALESCE(excluded.semantic_model_json, datahub_datasets.semantic_model_json),
                governance_policy_json = excluded.governance_policy_json,
                governance_readiness_json = excluded.governance_readiness_json
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
                json.dumps(policy),
                json.dumps(readiness) if readiness else None,
            ),
        )
        conn.commit()
        conn.close()

        response = {'message': 'Dataset registered successfully', 'governance_policy': policy}
        if readiness:
            response['governance_readiness'] = readiness
        return jsonify(response), 201

    except GovernancePolicyError as e:
        return jsonify({'error': f'Invalid governance policy: {e}'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to register dataset: {str(e)}'}), 500


@datahub_bp.route('/<dataset_id>', methods=['DELETE'])
def delete_dataset(dataset_id):
    try:
        deleted = delete_catalog_source(dataset_id)
    except WorkspaceContextError as exc:
        status_code = 409 if exc.code == "source_has_dependencies" else 400
        return jsonify({
            "error": {
                "code": exc.code,
                "message": str(exc),
                **({"details": exc.details} if exc.details else {}),
            }
        }), status_code

    if not deleted:
        return jsonify({
            "error": {
                "code": "source_not_found",
                "message": f"Source '{dataset_id}' was not found.",
            }
        }), 404

    return jsonify({
        "message": "Dataset deleted successfully",
        "source_id": dataset_id,
    }), 200


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


@datahub_bp.route('/<dataset_id>/governance-readiness', methods=['GET'])
def get_dataset_governance_readiness(dataset_id):
    """Evaluate the stored dataset immediately before it is used downstream."""
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        'SELECT id, name, path, governance_policy_json FROM datahub_datasets WHERE id = ?',
        (dataset_id,),
    ).fetchone()
    conn.close()
    if row is None:
        return jsonify({'error': 'Dataset not found'}), 404

    try:
        policy = json.loads(row['governance_policy_json']) if row['governance_policy_json'] else None
        readiness = evaluate_dataset_readiness(read_dataset_file(row['path']), policy, operation='datahub_read')
    except (ValueError, OSError, GovernancePolicyError) as exc:
        return jsonify({'error': f'Unable to evaluate dataset governance: {exc}'}), 400

    conn = get_db_connection()
    conn.execute('UPDATE datahub_datasets SET governance_readiness_json = ? WHERE id = ?', (json.dumps(readiness), dataset_id))
    conn.commit()
    conn.close()
    status_code = 422 if is_blocked(readiness) else 200
    if is_blocked(readiness):
        return jsonify(governance_error_payload(readiness)), status_code
    return jsonify({'governance_readiness': readiness}), status_code


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
            'SELECT id, name, path, semantic_model_json, governance_policy_json '
            f'FROM datahub_datasets WHERE id IN ({placeholders})'
        )
        rows = conn.execute(query, dataset_ids).fetchall()
        conn.close()

        id_to_record = {
            row['id']: {
                'name': row['name'],
                'path': row['path'],
                'semantic_model': json.loads(row['semantic_model_json']) if row['semantic_model_json'] else None,
                'governance_policy': json.loads(row['governance_policy_json']) if row['governance_policy_json'] else None,
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
                readiness = evaluate_dataset_readiness(dataframe, record['governance_policy'], operation='datahub_fetch_rows')
                if is_blocked(readiness):
                    results[dataset_id] = governance_error_payload(readiness)
                    continue
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
                    'governance_readiness': readiness,
                }
            except Exception as e:
                results[dataset_id] = {'error': f'Failed to read file: {str(e)}'}

        return jsonify({'datasets': results}), 200

    except Exception as e:
        return jsonify({'error': f'Internal error fetching rows: {str(e)}'}), 500
