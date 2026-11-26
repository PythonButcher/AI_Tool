"""Save and open identity-scoped working datasets through Data Hub."""

from contextlib import closing
from hashlib import sha256
import json
from uuid import uuid4

from backend.db.backend_db import get_db_connection
from backend.repositories import saved_dataset_repository as repository
from backend.repositories.source_workspace_repository import get_source, get_workspace, serialize_source
from backend.services.business_objects import list_business_objects
from backend.services.data_catalog_lineage import evaluate_dataset_readiness, is_blocked
from backend.services.dataset_context import safe_json_records
from backend.services.relationship_execution import (
    RelationshipExecutionError, execute_analysis_context, resolve_active_model_analysis_context,
)
from backend.services.semantic_model import infer_semantic_model_from_dataframe
from backend.services.workspace_cleaning import prepare_source
from backend.services.workspace_context import (
    WorkspaceContextError, _source_alias, _utc_now, build_analysis_context, dataframe_schema, register_managed_upload,
)


class SavedDatasetError(ValueError):
    def __init__(self, code, message, status=409, **details):
        super().__init__(message)
        self.code = code
        self.status = status
        self.details = details


class _ConcurrentSaveReplay(Exception):
    def __init__(self, receipt):
        self.receipt = receipt


def _single_source(source, timestamp):
    source_id = source['source_id']
    return {
        'primary_source_id': source_id,
        'memberships': [{
            'source_id': source_id, 'alias': _source_alias(source['name']), 'role': 'primary',
            'position': None, 'added_at': timestamp,
        }],
        'relationships': [], 'objects': [],
        'scope': {'source_ids': [source_id], 'relationship_ids': []},
    }


def _request(payload):
    required = {'request_id', 'name', 'kind', 'workspace_id', 'workspace_version', 'source_id'}
    optional = {'dataset_id', 'expected_revision', 'analysis_context', 'steps', 'source_fingerprint'}
    if not isinstance(payload, dict) or not required <= payload.keys() or payload.keys() - required - optional:
        raise SavedDatasetError('invalid_save_request', 'Supply the dataset name, kind, request ID, and workspace and source identities.', 400)
    for key, limit in {'name': 160, 'request_id': 128, 'workspace_id': 128, 'source_id': 256}.items():
        value = payload[key]
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
            raise SavedDatasetError('invalid_save_request', f'{key} must contain between 1 and {limit} characters.', 400)
    normalized = {**payload, 'name': payload['name'].strip(), 'request_id': payload['request_id'].strip()}
    if payload['kind'] not in ('current', 'source', 'model', 'refined') or type(payload['workspace_version']) is not int or payload['workspace_version'] < 1:
        raise SavedDatasetError('invalid_save_request', 'Supply a supported save kind and a positive workspace version.', 400)
    if {'dataset_id', 'expected_revision'} & payload.keys():
        dataset_id, revision = payload.get('dataset_id'), payload.get('expected_revision')
        if not isinstance(dataset_id, str) or not dataset_id or type(revision) is not int or revision < 1:
            raise SavedDatasetError('invalid_save_request', 'Updates require a saved dataset ID and a positive expected revision.', 400)
    if 'analysis_context' in payload and (payload['kind'] not in ('current', 'model') or not isinstance(payload['analysis_context'], dict)):
        raise SavedDatasetError('invalid_save_request', 'An explicit analysis context is supported for a model save.', 400)
    if payload['kind'] == 'refined':
        if not isinstance(payload.get('steps'), list) or not payload['steps'] or not isinstance(payload.get('source_fingerprint'), str):
            raise SavedDatasetError('invalid_save_request', 'A refined save requires applied steps and their preview source fingerprint.', 400)
    elif 'steps' in payload or 'source_fingerprint' in payload:
        raise SavedDatasetError('invalid_save_request', 'Transformation steps and their source fingerprint are for refined saves.', 400)
    return normalized


def _retry(conn, request_id, request_hash):
    existing = repository.get_receipt(conn, request_id)
    if existing is None:
        return None
    if existing['request_hash'] != request_hash:
        raise SavedDatasetError('save_request_reused', 'Use a new request ID for a different save.')
    return json.loads(existing['receipt_json'])


def _current_revision(conn, request):
    if 'dataset_id' not in request:
        return None
    record = repository.get_saved_dataset(conn, request['dataset_id'])
    if record is None:
        raise SavedDatasetError('saved_dataset_not_found', 'The saved dataset was removed.', 404)
    if record['revision'] != request['expected_revision']:
        raise SavedDatasetError('saved_dataset_revision_conflict', 'This dataset was saved again. Reopen it or save a named copy.', current_revision=record['revision'])
    return record


def _working_workspace(conn, request):
    workspace = get_workspace(request['workspace_id'], connection=conn)
    if workspace is None:
        raise SavedDatasetError('workspace_not_found', 'The working dataset could not be found.', 404)
    if workspace['version'] != request['workspace_version'] or workspace['primary_source_id'] != request['source_id']:
        raise SavedDatasetError('workspace_version_conflict', 'Reload the working dataset before saving again.')
    return workspace


def _dependency_error(exc):
    return SavedDatasetError('saved_dataset_dependency_changed', str(exc), source_id=exc.source_id)


def _verify_dependencies(conn, definition):
    try:
        repository.verify_dependencies(conn, definition['dependencies'])
    except repository.DatasetDependencyError as exc:
        raise _dependency_error(exc) from exc


def _capture(conn, workspace, kind):
    if kind == 'model':
        definition = repository.capture_model(conn, workspace)
    else:
        source = get_source(workspace['primary_source_id'], connection=conn)
        definition = _single_source(source, workspace['created_at'])
    try:
        definition['dependencies'] = {
            member['source_id']: repository.source_dependency(conn, member['source_id'])
            for member in definition['memberships']
        }
    except repository.DatasetDependencyError as exc:
        raise _dependency_error(exc) from exc
    # A working copy may refer to inputs pinned by an earlier save.
    pinned = repository.activation_dependencies(conn, workspace['workspace_id']) or {}
    if any(pinned[source_id] != version for source_id, version in definition['dependencies'].items() if source_id in pinned):
        raise SavedDatasetError('saved_dataset_dependency_changed', 'A pinned source changed. Start with its current source from Data Hub.')
    return definition


def _has_relationships(conn, workspace_id):
    return conn.execute('SELECT 1 FROM workspace_relationships WHERE workspace_id = ? LIMIT 1', (workspace_id,)).fetchone() is not None


def _has_model(conn, workspace):
    return (len(workspace['sources']) > 1 or _has_relationships(conn, workspace['workspace_id']) or conn.execute(
        'SELECT 1 FROM workspace_business_objects WHERE workspace_id = ? LIMIT 1', (workspace['workspace_id'],),
    ).fetchone() is not None)


def _execute(context):
    try:
        return execute_analysis_context(context)
    except RelationshipExecutionError as exc:
        if exc.code == 'multi_source_governance_blocked':
            blocking = next(item['readiness'] for item in exc.diagnostics if item['readiness']['status'] == 'blocked')
            raise SavedDatasetError(exc.code, str(exc), 422, governance_readiness={
                'schema_version': 'multi_source_governance_v1', 'status': 'blocked', 'severity': 'critical',
                'next_action': blocking['next_action'], 'sources': exc.diagnostics,
            }) from exc
        raise SavedDatasetError(exc.code, str(exc), diagnostics=exc.diagnostics) from exc


def _model_scope(request, workspace):
    context = request.get('analysis_context')
    if context is None:
        try:
            context = resolve_active_model_analysis_context(workspace['workspace_id'])
        except RelationshipExecutionError as exc:
            raise SavedDatasetError(exc.code, str(exc), diagnostics=exc.diagnostics) from exc
    if context.get('workspace_id') != workspace['workspace_id'] or context.get('workspace_version') != workspace['version']:
        raise SavedDatasetError('workspace_version_conflict', 'The analysis selection belongs to a different workspace revision.')
    invalid_objects = [item['object_id'] for item in list_business_objects(workspace['workspace_id']) if item['configuration_error']]
    if invalid_objects:
        raise SavedDatasetError('saved_dataset_object_conflict', 'Repair the changed Business Object references before saving this model.', object_ids=invalid_objects)
    return _execute(context)


def _commit_revision(conn, request, request_hash, definition, kind, restored=None):
    current = _current_revision(conn, request)
    timestamp = _utc_now()
    workspace, relationship_ids, object_ids = restored or repository.restore_workspace(conn, request['name'], definition, timestamp)
    activation = {'relationship_ids': relationship_ids, 'object_ids': object_ids}
    return repository.store_revision(conn, {
        'dataset_id': current['dataset_id'] if current else f'saved_{uuid4().hex}',
        'name': request['name'], 'kind': kind, 'revision': current['revision'] + 1 if current else 1,
        'workspace_id': workspace['workspace_id'], 'definition': {**definition, 'activation': activation},
        'created_at': current['created_at'] if current else timestamp, 'updated_at': timestamp,
    }, request['request_id'], request_hash)


def _refine_input(conn, workspace):
    if len(workspace['sources']) != 1 or _has_relationships(conn, workspace['workspace_id']):
        raise SavedDatasetError('preparation_relationships_unsupported', 'Refine requires a working dataset with one source and no relationships.')
    source = get_source(workspace['primary_source_id'], connection=conn)
    definition = _capture(conn, workspace, 'source')
    return source, definition['dependencies'][source['source_id']], repository.capture_objects(conn, workspace['workspace_id'])


def _prepare_refined(request, workspace, source, objects):
    _execute(build_analysis_context(workspace, [source['source_id']]))
    try:
        cleaned, encoded, _ = prepare_source(source, request['steps'])
    except WorkspaceContextError as exc:
        raise SavedDatasetError(exc.code, str(exc), 400) from exc
    if cleaned.empty or not len(cleaned.columns):
        raise SavedDatasetError('empty_cleaning_result', 'Adjust the steps so the result contains rows and columns.', 400)
    readiness = evaluate_dataset_readiness(cleaned, source['governance_policy'], operation='manual_cleaning')
    if is_blocked(readiness):
        raise SavedDatasetError('governance_blocked', 'Refine violates the source governance policy.', 422, governance_readiness=readiness)
    unsupported_objects = [item['object_id'] for item in objects if (
        item['source_id'] != source['source_id'] or item['record_key_field'] not in cleaned.columns
        or (item['display_field'] is not None and item['display_field'] not in cleaned.columns)
        or json.loads(item['relationship_ids_json'])
    )]
    if unsupported_objects:
        raise SavedDatasetError('refine_business_object_conflict', 'These steps would invalidate a Business Object. Keep its configured fields before saving.', object_ids=unsupported_objects)
    preview = json.loads(cleaned.head(100).to_json(orient='records', date_format='iso'))
    return cleaned, encoded, readiness, preview


def preview_refine(payload: object) -> dict:
    required = {'workspace_id', 'workspace_version', 'source_id', 'steps'}
    if not isinstance(payload, dict) or payload.keys() != required:
        raise SavedDatasetError('invalid_refine_request', 'Supply workspace ID, version, source ID, and transformation steps.', 400)
    request = _request({**payload, 'kind': 'refined', 'request_id': 'preview', 'name': 'Preview', 'source_fingerprint': ''})
    with closing(get_db_connection()) as conn, conn:
        conn.execute('BEGIN')
        workspace = _working_workspace(conn, request)
        source, dependency, objects = _refine_input(conn, workspace)
    cleaned, _, readiness, preview = _prepare_refined(request, workspace, source, objects)
    with closing(get_db_connection()) as conn, conn:
        conn.execute('BEGIN')
        current = _working_workspace(conn, request)
        if _refine_input(conn, current) != (source, dependency, objects):
            raise SavedDatasetError('workspace_version_conflict', 'The source changed during preview. Try again.')
    return {
        'preview': preview, 'row_count': len(cleaned), 'schema': dataframe_schema(cleaned),
        'source_fingerprint': dependency['fingerprint'], 'governance_readiness': readiness,
    }


def _register_refined(request, workspace, source, dependency, objects, publish):
    if 'source_fingerprint' in request and request['source_fingerprint'] != dependency['fingerprint']:
        raise SavedDatasetError('saved_dataset_dependency_changed', 'The source changed after preview. Apply the steps again before saving.')
    cleaned, encoded, readiness, preview = _prepare_refined(request, workspace, source, objects)
    semantic_model = infer_semantic_model_from_dataframe(
        cleaned, source='manual_cleaning', existing_model=source['semantic_model'], preserve_user_metrics=True,
    )
    receipt = None

    def register_revision(conn, derived, derived_workspace):
        nonlocal receipt
        current = _working_workspace(conn, request)
        if _refine_input(conn, current) != (source, dependency, objects):
            raise SavedDatasetError('workspace_version_conflict', 'The source changed while refining. Apply the steps again.')
        lineage = {'parent_source_id': source['source_id'], 'parent_content_fingerprint': dependency['fingerprint'],
                   'parent_schema_version': dependency['schema_version']}
        conn.execute('INSERT INTO saved_dataset_derivations VALUES (?, ?)', (derived['source_id'], json.dumps(lineage)))
        definition = _capture(conn, derived_workspace, 'source')
        definition['objects'] = [{**item, 'source_id': derived['source_id']} for item in objects]
        object_ids = repository.restore_objects(conn, derived_workspace['workspace_id'], definition['objects'], {})
        conn.execute('INSERT INTO dataset_activation_workspaces VALUES (?, ?)', (
            derived_workspace['workspace_id'], json.dumps(definition['dependencies']),
        ))
        receipt = publish(conn, {**definition, 'lineage': lineage, 'shape': list(cleaned.shape)}, (derived_workspace, {}, object_ids))

    try:
        register_managed_upload(
            file_bytes=encoded, filename='prepared.table.json', dataframe=cleaned, semantic_model=semantic_model,
            governance_policy=readiness['policy'], governance_readiness=readiness, preview=preview,
            before_commit=register_revision,
        )
    except _ConcurrentSaveReplay as replay:
        return replay.receipt, True
    return receipt, False


def _save_refined(request, request_hash, workspace, source, dependency, objects):
    def publish(conn, definition, restored):
        if (previous := _retry(conn, request['request_id'], request_hash)) is not None:
            raise _ConcurrentSaveReplay(previous)
        return _commit_revision(conn, request, request_hash, definition, 'refined', restored)

    return _register_refined(request, workspace, source, dependency, objects, publish)


def apply_refine(payload: object) -> dict:
    required = {'workspace_id', 'workspace_version', 'source_id', 'steps', 'request_id'}
    if not isinstance(payload, dict) or not required <= payload.keys() or payload.keys() - required - {'source_fingerprint'}:
        raise SavedDatasetError('invalid_refine_request', 'Supply workspace ID, version, source ID, transformation steps, and a request ID.', 400)
    request = _request({'source_fingerprint': '', **payload, 'kind': 'refined', 'name': 'Refined working data'})
    if 'source_fingerprint' not in payload:
        request.pop('source_fingerprint')
    request_hash = _request_hash(request)

    def previous_workspace(conn):
        row = conn.execute('SELECT * FROM workspace_refine_operations WHERE request_id = ?', (request['request_id'],)).fetchone()
        if row and row['request_hash'] != request_hash:
            raise SavedDatasetError('save_request_reused', 'Use a new request ID for a different Refine operation.')
        return row['workspace_id'] if row else None

    with closing(get_db_connection()) as conn, conn:
        conn.execute('BEGIN')
        workspace_id = previous_workspace(conn)
        if workspace_id is None:
            workspace = _working_workspace(conn, request)
            source, dependency, objects = _refine_input(conn, workspace)

    def publish(conn, _definition, restored):
        if (previous := previous_workspace(conn)) is not None:
            raise _ConcurrentSaveReplay(previous)
        derived_id = restored[0]['workspace_id']
        conn.execute('INSERT INTO workspace_refine_operations VALUES (?, ?, ?)', (request['request_id'], request_hash, derived_id))
        return derived_id

    if workspace_id is None:
        workspace_id, _ = _register_refined(request, workspace, source, dependency, objects, publish)
    workspace = get_workspace(workspace_id)
    if workspace is None or workspace['version'] != 1:
        raise SavedDatasetError('workspace_version_conflict', 'The refined workspace changed. Continue with its current data.')
    source = get_source(workspace['primary_source_id'])
    bundle = _execute(build_analysis_context(workspace, [workspace['primary_source_id']]))
    return _workbench_envelope(workspace, source, bundle, include_full=True)


def _request_hash(request):
    return sha256(json.dumps(request, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def save_dataset(payload: object) -> tuple[dict, bool]:
    request = _request(payload)
    request_hash = _request_hash(request)
    with closing(get_db_connection()) as conn, conn:
        conn.execute('BEGIN')
        if (receipt := _retry(conn, request['request_id'], request_hash)) is not None:
            return receipt, True
        _current_revision(conn, request)
        workspace = _working_workspace(conn, request)
        kind = request['kind']
        if kind == 'current':
            kind = 'model' if _has_model(conn, workspace) else 'source'
        if kind == 'refined':
            source, dependency, objects = _refine_input(conn, workspace)
        else:
            if kind == 'source' and _has_model(conn, workspace):
                raise SavedDatasetError('model_save_required', 'Save the working data as a model to preserve its configuration.')
            definition = _capture(conn, workspace, kind)

    if kind == 'refined':
        return _save_refined(request, request_hash, workspace, source, dependency, objects)
    if kind == 'model':
        bundle = _model_scope(request, workspace)
    else:
        bundle = _execute(build_analysis_context(workspace, [request['source_id']]))
    context = bundle['analysis_context']
    scope = {key: context[key] for key in ('source_ids', 'relationship_ids')}

    with closing(get_db_connection()) as conn, conn:
        conn.execute('BEGIN IMMEDIATE')
        if (receipt := _retry(conn, request['request_id'], request_hash)) is not None:
            return receipt, True
        current_workspace = _working_workspace(conn, request)
        if kind == 'source' and _has_model(conn, current_workspace):
            raise SavedDatasetError('model_save_required', 'The work gained model configuration while saving. Save it as a model.')
        if _capture(conn, current_workspace, kind) != definition:
            raise SavedDatasetError('workspace_version_conflict', 'The working configuration changed while saving. Reload it and try again.')
        lineage_row = conn.execute('SELECT lineage_json FROM saved_dataset_derivations WHERE source_id = ?', (request['source_id'],)).fetchone()
        lineage = json.loads(lineage_row['lineage_json']) if lineage_row else None
        kind = 'refined' if lineage and kind == 'source' else kind
        return _commit_revision(conn, request, request_hash, {
            **definition, 'scope': scope, 'lineage': lineage, 'shape': list(bundle['dataframe'].shape),
        }, kind), False


def list_datasets() -> list[dict]:
    """Keep named records distinct from their compatible catalog sources."""
    with closing(get_db_connection()) as conn, conn:
        conn.execute('BEGIN')
        named = []
        for row in conn.execute('SELECT * FROM saved_datasets ORDER BY updated_at DESC, dataset_id'):
            record = dict(row)
            record['definition'] = json.loads(record.pop('definition_json'))
            named.append(repository.public_record(record))
        legacy = [
            {'dataset_id': row['id'], 'kind': 'legacy', 'revision': None, **serialize_source(row)}
            for row in conn.execute('''
                SELECT source.* FROM datahub_datasets source
                WHERE source.locator_kind <> 'managed_file' OR source.source_kind = 'sql'
                ORDER BY COALESCE(source.created_at, source.uploadedAt) DESC, source.id
            ''')
        ]
    return named + legacy


def delete_saved_dataset(dataset_id: str) -> None:
    with closing(get_db_connection()) as conn, conn:
        if not conn.execute('DELETE FROM saved_datasets WHERE dataset_id = ?', (dataset_id,)).rowcount:
            raise SavedDatasetError('saved_dataset_not_found', 'Saved dataset not found.', 404)


def _open_named(conn, record):
    definition = record['definition']
    _verify_dependencies(conn, definition)
    workspace = get_workspace(record['workspace_id'], connection=conn)
    activation = definition['activation']
    # A changed working copy may still be referenced by an Analytics draft.
    # Restore the save into a new workspace so the draft keeps its identities.
    if workspace is not None and workspace['version'] == 1:
        object_ids = {row['object_id'] for row in conn.execute(
            'SELECT object_id FROM workspace_business_objects WHERE workspace_id = ?', (workspace['workspace_id'],),
        )}
        if object_ids != set(activation['object_ids'].values()):
            workspace = None
    if workspace is None or workspace['version'] != 1:
        workspace, relationships, objects = repository.restore_workspace(conn, record['name'], definition, _utc_now())
        activation = {'relationship_ids': relationships, 'object_ids': objects}
        definition = {**definition, 'activation': activation}
        conn.execute('UPDATE saved_datasets SET workspace_id = ?, definition_json = ? WHERE dataset_id = ?', (
            workspace['workspace_id'], json.dumps(definition), record['dataset_id'],
        ))
    scope = definition['scope']
    context = build_analysis_context(workspace, scope['source_ids'], [
        activation['relationship_ids'][relationship_id] for relationship_id in scope['relationship_ids']
    ])
    return repository.public_record(record), workspace, context, activation


def _open_legacy(conn, dataset_id):
    source = get_source(dataset_id, connection=conn)
    if source is None or (source['locator_kind'] == 'managed_file' and source['source_kind'] != 'sql'):
        raise SavedDatasetError('saved_dataset_not_found', 'Dataset not found in Data Hub.', 404)
    candidates = conn.execute('''
        SELECT workspace.workspace_id FROM data_workspaces workspace
        JOIN workspace_sources member ON member.workspace_id = workspace.workspace_id AND member.source_id = ?
        LEFT JOIN dataset_activation_workspaces activation ON activation.workspace_id = workspace.workspace_id
        WHERE workspace.primary_source_id = ? AND activation.workspace_id IS NULL
          AND (? <> 'sql' OR workspace.workspace_kind <> 'postgres')
        ORDER BY workspace.workspace_id
    ''', (dataset_id, dataset_id, source['source_kind'])).fetchall()
    if len(candidates) > 1:
        raise SavedDatasetError('ambiguous_dataset_workspace', 'This source is primary in multiple workspaces. Save the intended working dataset by name.')
    if candidates:
        workspace = get_workspace(candidates[0]['workspace_id'], connection=conn)
        context = None  # Resolve the current active relationship scope after releasing the write lock.
    else:
        existing = conn.execute('''
            SELECT workspace.workspace_id FROM data_workspaces workspace
            JOIN dataset_activation_workspaces activation ON activation.workspace_id = workspace.workspace_id
            WHERE workspace.primary_source_id = ? AND activation.dependencies_json IS NULL
        ''', (dataset_id,)).fetchone()
        if existing:
            workspace = get_workspace(existing['workspace_id'], connection=conn)
            context = None
        else:
            workspace, _, _ = repository.restore_workspace(conn, source['name'], _single_source(source, _utc_now()), _utc_now())
            context = build_analysis_context(workspace, [dataset_id])
    record = {
        'dataset_id': dataset_id, 'name': source['name'], 'kind': 'legacy', 'revision': None,
        'primary_source_id': dataset_id, 'source_kind': source['source_kind'],
    }
    return record, workspace, context, None


def open_dataset(dataset_id: str, *, offset: int = 0, limit: int = 100, expected_revision: int | None = None, include_full: bool = True) -> dict:
    with closing(get_db_connection()) as conn, conn:
        conn.execute('BEGIN IMMEDIATE')
        saved = repository.get_saved_dataset(conn, dataset_id)
        if expected_revision is not None and (saved is None or saved['revision'] != expected_revision):
            raise SavedDatasetError('saved_dataset_revision_conflict', 'The saved dataset changed. Reopen it to inspect the latest revision.')
        record, workspace, context, identity_map = _open_named(conn, saved) if saved else _open_legacy(conn, dataset_id)
    if context is None:
        try:
            context = resolve_active_model_analysis_context(workspace['workspace_id'])
        except RelationshipExecutionError as exc:
            raise SavedDatasetError(exc.code, str(exc), diagnostics=exc.diagnostics) from exc
    bundle = _execute(context)
    source = get_source(workspace['primary_source_id'])
    if source is None or workspace != get_workspace(workspace['workspace_id']):
        raise SavedDatasetError('workspace_version_conflict', 'The workspace changed while opening. Try again.')
    with closing(get_db_connection()) as conn:
        if saved:
            current = repository.get_saved_dataset(conn, dataset_id)
            if not current or current['revision'] != record['revision'] or current['workspace_id'] != workspace['workspace_id']:
                raise SavedDatasetError('saved_dataset_revision_conflict', 'The saved dataset changed while opening. Try again.')
        has_relationships = _has_relationships(conn, workspace['workspace_id'])
        save_kind = 'model' if _has_model(conn, workspace) else 'source'
    return {
        **_workbench_envelope(workspace, source, bundle, offset=offset, limit=limit, include_full=include_full),
        'dataset': record,
        'capabilities': {'refine': not has_relationships and len(workspace['sources']) == 1, 'save_kind': save_kind},
        'identity_map': identity_map,
    }


def _workbench_envelope(workspace, source, bundle, *, offset=0, limit=100, include_full=False):
    dataframe = bundle['dataframe']
    preview_frame = dataframe.iloc[offset:offset + limit]
    sql_snapshot = source['source_kind'] == 'sql'
    preview = safe_json_records(preview_frame) if sql_snapshot else json.loads(preview_frame.to_json(orient='records', date_format='iso'))
    envelope = {
        'workspace': workspace, 'source': source, 'analysis_context': bundle['analysis_context'],
        'analysis_lineage': bundle['analysis_lineage'], 'governance_readiness': bundle['governance_readiness'],
        'semantic_model': bundle['semantic_model'], 'schema': dataframe_schema(dataframe),
        'preview': preview, 'data_preview': preview,
        'row_count': len(dataframe), 'offset': offset, 'has_more': offset + limit < len(dataframe),
    }
    if include_full:
        envelope['full_data'] = safe_json_records(dataframe) if sql_snapshot else json.loads(dataframe.to_json(orient='records', date_format='iso'))
    return envelope
