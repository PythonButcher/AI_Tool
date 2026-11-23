"""Persist named dataset definitions and restore them into usable workspaces."""

import json
from hashlib import file_digest
from pathlib import Path
from uuid import uuid4

from backend.repositories.source_workspace_repository import get_source_private_locator, get_workspace


class DatasetDependencyError(ValueError):
    def __init__(self, source_id, reason):
        self.source_id = source_id
        super().__init__(reason)


def source_dependency(conn, source_id):
    row = conn.execute('SELECT schema_version, content_fingerprint FROM datahub_datasets WHERE id = ?', (source_id,)).fetchone()
    if row is None:
        raise DatasetDependencyError(source_id, 'The source has been removed.')
    locator = get_source_private_locator(source_id, connection=conn)
    path = Path(locator['path'].strip('"').strip("'"))
    try:
        with path.open('rb') as handle:
            fingerprint = f"sha256:{file_digest(handle, 'sha256').hexdigest()}"
    except (OSError, ValueError) as exc:
        raise DatasetDependencyError(source_id, 'The source file is unavailable.') from exc
    if row['content_fingerprint'] and row['content_fingerprint'] != fingerprint:
        raise DatasetDependencyError(source_id, 'The managed source file has changed.')
    return {'fingerprint': fingerprint, 'schema_version': row['schema_version']}


def verify_dependencies(conn, dependencies):
    for source_id, expected in dependencies.items():
        if source_dependency(conn, source_id) != expected:
            raise DatasetDependencyError(source_id, 'The source content or schema has changed.')


def activation_dependencies(conn, workspace_id):
    row = conn.execute('SELECT dependencies_json FROM dataset_activation_workspaces WHERE workspace_id = ?', (workspace_id,)).fetchone()
    return json.loads(row['dependencies_json']) if row and row['dependencies_json'] else None


def get_saved_dataset(conn, dataset_id):
    row = conn.execute('SELECT * FROM saved_datasets WHERE dataset_id = ?', (dataset_id,)).fetchone()
    if row is None:
        return None
    record = dict(row)
    record['definition'] = json.loads(record.pop('definition_json'))
    return record


def public_record(record):
    definition = record['definition']
    row_count, column_count = definition.get('shape', (None, None))
    return {
        **{key: record[key] for key in ('dataset_id', 'name', 'kind', 'revision', 'created_at', 'updated_at')},
        'primary_source_id': definition['primary_source_id'],
        'source_ids': [member['source_id'] for member in definition['memberships']],
        'lineage': definition.get('lineage'),
        'row_count': row_count,
        'column_count': column_count,
    }


def capture_model(conn, workspace):
    workspace_id = workspace['workspace_id']
    return {
        'primary_source_id': workspace['primary_source_id'],
        'memberships': [
            {key: member[key] for key in ('source_id', 'alias', 'role', 'position', 'added_at')}
            for member in workspace['sources']
        ],
        'relationships': [dict(row) for row in conn.execute(
            'SELECT * FROM workspace_relationships WHERE workspace_id = ? ORDER BY created_at, relationship_id',
            (workspace_id,),
        )],
        'objects': capture_objects(conn, workspace_id),
    }


def capture_objects(conn, workspace_id):
    return [dict(row) for row in conn.execute(
        'SELECT * FROM workspace_business_objects WHERE workspace_id = ? ORDER BY created_at, object_id',
        (workspace_id,),
    )]


def restore_workspace(conn, name, definition, timestamp):
    """Copy saved model configuration, retaining original source identities."""
    workspace_id = f'ws_{uuid4().hex}'
    primary_id = definition['primary_source_id']
    conn.execute('''
        INSERT INTO data_workspaces (workspace_id, name, version, primary_source_id, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?, ?)
    ''', (workspace_id, name, primary_id, timestamp, timestamp))
    conn.execute('INSERT INTO dataset_activation_workspaces VALUES (?, ?)', (
        workspace_id, json.dumps(definition['dependencies']) if 'dependencies' in definition else None,
    ))
    conn.executemany('''
        INSERT INTO workspace_sources (workspace_id, source_id, alias, role, position_json, added_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', [(workspace_id, member['source_id'], member['alias'], member['role'],
           json.dumps(member['position']) if member['position'] is not None else None, member['added_at'])
          for member in definition['memberships']])

    relationship_ids = {}
    for relationship in definition['relationships']:
        new_id = f'rel_{uuid4().hex}'
        relationship_ids[relationship['relationship_id']] = new_id
        conn.execute('''
            INSERT INTO workspace_relationships (
                relationship_id, workspace_id, left_source_id, right_source_id, field_pairs_json,
                cardinality, join_behavior, filter_direction, is_active, is_suggested, is_confirmed,
                validation_state, diagnostics_json, source_fingerprints_json, version, created_at,
                updated_at, validated_at
            ) VALUES (
                :relationship_id, :workspace_id, :left_source_id, :right_source_id, :field_pairs_json,
                :cardinality, :join_behavior, :filter_direction, :is_active, :is_suggested, :is_confirmed,
                :validation_state, :diagnostics_json, :source_fingerprints_json, :version, :created_at,
                :updated_at, :validated_at
            )
        ''', {**relationship, 'relationship_id': new_id, 'workspace_id': workspace_id})

    object_ids = restore_objects(conn, workspace_id, definition['objects'], relationship_ids)
    return get_workspace(workspace_id, connection=conn), relationship_ids, object_ids


def restore_objects(conn, workspace_id, objects, relationship_ids):
    object_ids = {}
    for item in objects:
        new_id = f'obj_{uuid4().hex}'
        object_ids[item['object_id']] = new_id
        conn.execute('''
            INSERT INTO workspace_business_objects (
                object_id, workspace_id, display_name, source_id, record_key_field, display_field,
                relationship_ids_json, created_at
            ) VALUES (
                :object_id, :workspace_id, :display_name, :source_id, :record_key_field, :display_field,
                :relationship_ids_json, :created_at
            )
        ''', {**item, 'object_id': new_id, 'workspace_id': workspace_id, 'relationship_ids_json': json.dumps([
            relationship_ids[relationship_id] for relationship_id in json.loads(item['relationship_ids_json'])
        ])})
    return object_ids


def get_receipt(conn, request_id):
    return conn.execute('''
        SELECT request_hash, receipt_json FROM saved_dataset_operations WHERE request_id = ?
    ''', (request_id,)).fetchone()


def store_revision(conn, record, request_id, request_hash):
    conn.execute('''
        INSERT INTO saved_datasets (dataset_id, name, kind, revision, workspace_id, definition_json, created_at, updated_at)
        VALUES (:dataset_id, :name, :kind, :revision, :workspace_id, :definition_json, :created_at, :updated_at)
        ON CONFLICT (dataset_id) DO UPDATE SET name = excluded.name, kind = excluded.kind,
            revision = excluded.revision, workspace_id = excluded.workspace_id,
            definition_json = excluded.definition_json, updated_at = excluded.updated_at
    ''', {**record, 'definition_json': json.dumps(record['definition'])})
    receipt = public_record(record)
    conn.execute('INSERT INTO saved_dataset_operations VALUES (?, ?, ?, ?)', (
        request_id, request_hash, record['dataset_id'], json.dumps(receipt),
    ))
    return receipt
