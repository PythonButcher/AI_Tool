"""Exercise the saved working dataset contract through the real routes and database."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from io import BytesIO
import json
from pathlib import Path
import subprocess
import sys

from flask import Flask
import pandas as pd
import pytest

from backend.db import backend_db
from backend.repositories.source_workspace_repository import get_source_private_locator, get_workspace
from backend.routes.analysis import analysis_bp
from backend.routes.analytics import analytics_bp
from backend.routes.datahub_routes import datahub_bp
from backend.routes.data_workspaces import data_workspaces_bp
from backend.routes.upload import upload_bp
from backend.services import business_objects, source_relationships, workspace_context
from backend.services.data_catalog_lineage import evaluate_dataset_readiness
from backend.services.dataset_context import safe_json_records
from backend.services.relationship_execution import execute_analysis_context
from backend.services.semantic_model import infer_semantic_model_from_dataframe


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setattr(backend_db, 'DB_PATH', str(tmp_path / 'saved.db'))
    monkeypatch.setattr(backend_db, '_SCHEMA_READY', False)
    monkeypatch.setattr(workspace_context, 'MANAGED_UPLOAD_ROOT', tmp_path / 'managed')
    app = Flask(__name__)
    for blueprint in (analysis_bp, analytics_bp, datahub_bp, data_workspaces_bp, upload_bp):
        app.register_blueprint(blueprint)
    return app


def upload(client, csv, name='orders.csv'):
    response = client.post('/api/upload', data={'file': (BytesIO(csv), name)})
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def save_request(workspace, request_id, **fields):
    return {
        'request_id': request_id, 'name': 'Quarterly data', 'kind': 'source',
        'workspace_id': workspace['workspace_id'], 'workspace_version': workspace['version'],
        'source_id': workspace['primary_source_id'], **fields,
    }


def save(client, **payload):
    response = client.post('/api/datahub/saved-datasets', json=payload)
    assert response.status_code in (200, 201), response.get_json()
    return response.get_json()['dataset']


def reopen(client, dataset_id, **options):
    response = client.post(f'/api/datahub/datasets/{dataset_id}/open', json=options)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def reopen_in_new_process(dataset_id, **options):
    result = subprocess.run([sys.executable, '-c', '''
import json
import sys
from flask import Flask
from backend.db import backend_db
from backend.routes.datahub_routes import datahub_bp

backend_db.DB_PATH, dataset_id, options = sys.argv[1:]
app = Flask(__name__)
app.register_blueprint(datahub_bp)
response = app.test_client().post(f'/api/datahub/datasets/{dataset_id}/open', json=json.loads(options))
assert response.status_code == 200, response.get_json()
print(json.dumps(response.get_json()))
''', backend_db.DB_PATH, dataset_id, json.dumps(options)], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_postgres_snapshots_remain_discoverable_without_publishing_uploads(app):
    client = app.test_client()
    uploaded = upload(client, b'id,units\n1,3\n')
    key = 9223372036854775806
    dataframe = pd.DataFrame({'id': [key], 'units': [4]})
    imported = workspace_context.register_managed_postgres_workspace(name='Orders', snapshots=[{
        'table': 'orders',
        'name': 'public.orders',
        'dataframe': dataframe,
        'file_bytes': dataframe.to_json(orient='table', index=False).encode(),
        'readiness': evaluate_dataset_readiness(dataframe, None, operation='postgres_snapshot'),
        'preview': safe_json_records(dataframe),
        'semantic_model': infer_semantic_model_from_dataframe(dataframe, dataset_name='orders', source='postgres_snapshot'),
    }])
    source_id = imported['source']['source_id']
    datasets = client.get('/api/datahub/datasets').get_json()['datasets']
    assert [(item['dataset_id'], item['source_kind']) for item in datasets] == [(source_id, 'sql')]
    legacy = client.get('/api/datahub/list').get_json()
    assert [item['id'] for item in legacy] == [source_id]
    assert 'path' not in legacy[0]
    opened = reopen(client, source_id)
    assert opened['full_data'] == [{'id': str(key), 'units': 4}]
    assert opened['analysis_context']['source_ids'] == [source_id]
    assert opened['workspace']['workspace_id'] != imported['workspace']['workspace_id']
    assert client.post(f"/api/datahub/datasets/{uploaded['source']['source_id']}/open").status_code == 404
    assert client.post('/api/datahub/register', json={'id': source_id, 'name': 'Replace', 'path': 'other.csv'}).status_code == 409
    registered = client.post('/api/datahub/register', json={'id': 'legacy', 'name': 'Legacy file', 'path': 'other.csv'})
    assert registered.status_code == 201, registered.get_json()


def test_named_upload_reuses_bytes_and_reopens_all_pages_with_distinct_ids(app):
    client = app.test_client()
    raw = b'id,units\n' + b''.join(f'{index},{index * 3}\n'.encode() for index in range(1, 232))
    uploaded = upload(client, raw)
    workspace = uploaded['workspace']
    assert client.get('/api/datahub/datasets').get_json() == {'datasets': []}
    assert client.get('/api/datahub/list').get_json() == []
    assert client.post(f"/api/datahub/datasets/{uploaded['source']['source_id']}/open").status_code == 404
    first = save(client, **save_request(workspace, 'initial', kind='current'))
    second = save(client, **save_request(workspace, 'copy'))
    assert first['name'] == second['name']
    assert first['dataset_id'] != second['dataset_id']
    assert list(workspace_context.MANAGED_UPLOAD_ROOT.iterdir())[0].read_bytes() == raw
    assert len(list(workspace_context.MANAGED_UPLOAD_ROOT.iterdir())) == 1
    assert get_workspace(workspace['workspace_id']) == workspace

    names = client.get('/api/datahub/datasets').get_json()['datasets']
    assert len(names) == 2
    assert {item['dataset_id'] for item in names if item['name'] == first['name']} == {first['dataset_id'], second['dataset_id']}
    opened = reopen_in_new_process(first['dataset_id'], limit=200)
    last = reopen(client, first['dataset_id'], offset=200, expected_revision=1)
    assert opened['workspace']['workspace_id'] == last['workspace']['workspace_id']
    assert opened['analysis_context']['source_ids'] == [uploaded['source']['source_id']]
    assert opened['row_count'] == 231
    assert opened['has_more'] and not last['has_more']
    rows = opened['preview'] + last['preview']
    assert [row['units'] for row in rows] == [index * 3 for index in range(1, 232)]
    assert opened['capabilities']['refine']
    full = reopen(client, first['dataset_id'])
    assert full['full_data'] == rows


def test_retry_and_competing_updates_preserve_saved_revisions(app):
    client = app.test_client()
    uploaded = upload(client, b'id,units\n1,5\n')
    payload = save_request(uploaded['workspace'], 'initial')
    first = save(client, **payload)
    active = reopen(client, first['dataset_id'])
    update = save_request(active['workspace'], 'update', dataset_id=first['dataset_id'], expected_revision=1)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda key: app.test_client().post('/api/datahub/saved-datasets', json={
            **update, 'request_id': key,
        }), ['update', 'competing-update']))
    assert sorted(response.status_code for response in responses) == [201, 409]
    confirmed = next(response.get_json()['dataset'] for response in responses if response.status_code == 201)
    assert confirmed['revision'] == 2
    assert save(client, **payload) == first
    bad_retry = client.post('/api/datahub/saved-datasets', json={**payload, 'name': 'Different'})
    assert bad_retry.get_json()['error']['code'] == 'save_request_reused'
    assert reopen(client, first['dataset_id'])['dataset'] == confirmed
    # The old Analytics context still resolves after a newer revision is committed.
    assert execute_analysis_context(active['analysis_context'])['dataframe']['units'].tolist() == [5]


def test_related_model_restores_selected_scope_relationship_and_object(app):
    client = app.test_client()
    customers = upload(client, b'customer_id,name\n1,Ada\n2,Lin\n', 'customers.csv')
    orders = upload(client, b'buyer,total\n1,12\n1,8\n2,3\n')
    left, right = customers['source']['source_id'], orders['source']['source_id']
    workspace_id = customers['workspace']['workspace_id']
    workspace_context.add_source_to_workspace(workspace_id=workspace_id, source_id=right, version=1)
    relationship = source_relationships.create_relationship(workspace_id, {
        'left_source_id': left, 'right_source_id': right,
        'field_pairs': [{'left_field': 'customer_id', 'right_field': 'buyer'}],
        'cardinality': 'one_to_many', 'join_behavior': 'left', 'filter_direction': 'left_to_right',
    })
    relationship_id = relationship['relationship_id']
    source_relationships.validate_relationship(workspace_id, relationship_id)
    source_relationships.update_relationship(workspace_id, relationship_id, {'is_confirmed': True, 'is_active': True})
    object_payload = {'display_name': 'Customer', 'source_id': left, 'record_key_field': 'customer_id',
                      'display_field': 'name', 'relationship_ids': [relationship_id]}
    item = business_objects.create_business_object(workspace_id, object_payload)
    workspace = get_workspace(workspace_id)
    saved = save(client, **save_request(workspace, 'model', kind='current'))
    assert saved['kind'] == 'model'
    activated = reopen(client, saved['dataset_id'])
    restarted = reopen_in_new_process(saved['dataset_id'])
    for field in ('workspace', 'analysis_context', 'analysis_lineage', 'identity_map', 'preview', 'schema'):
        assert restarted[field] == activated[field]

    context = activated['analysis_context']
    active_relationship = activated['identity_map']['relationship_ids'][relationship_id]
    assert context['source_ids'] == [left, right]
    assert context['relationship_ids'] == [active_relationship]
    assert activated['analysis_lineage']['source_ids'] == [left, right]
    assert activated['row_count'] == 3
    assert not activated['capabilities']['refine']
    loaded = business_objects.list_business_objects(context['workspace_id'])
    assert [obj['object_id'] for obj in loaded] == [activated['identity_map']['object_ids'][item['object_id']]]
    assert loaded[0]['relationship_ids'] == [active_relationship]
    assert loaded[0]['configuration_error'] is None
    relationship = source_relationships.get_relationship(context['workspace_id'], active_relationship)
    assert relationship['field_pairs'] == [{'left_field': 'customer_id', 'right_field': 'buyer'}]
    assert execute_analysis_context(context)['dataframe']['orders.total'].tolist() == [12, 8, 3]
    analysis = client.post('/api/analytics/query', json={
        'source': {'kind': 'workspace', 'analysis_context': context},
        'query': {'measures': [{'id': 'value', 'field': 'orders.total', 'aggregation': 'sum'}]},
    })
    assert analysis.status_code == 200, analysis.get_json()
    assert analysis.get_json()['summary'] == {'value': 23}
    assert analysis.get_json()['analysis_lineage']['relationship_ids'] == [active_relationship]
    overview = client.post('/api/numbers', json={'analysis_context': context})
    assert overview.status_code == 200, overview.get_json()
    assert overview.get_json()['numeric_summary']['orders.total'] == 23

    edited = business_objects.create_business_object(context['workspace_id'], {
        **object_payload, 'display_name': 'Buyer', 'relationship_ids': [active_relationship],
    })
    last_confirmed = reopen(client, saved['dataset_id'])
    assert last_confirmed['workspace']['workspace_id'] != context['workspace_id']
    assert [obj['display_name'] for obj in business_objects.list_business_objects(last_confirmed['workspace']['workspace_id'])] == ['Customer']
    updated = save(client, **save_request(
        get_workspace(context['workspace_id']), 'update-model', kind='model', dataset_id=saved['dataset_id'],
        expected_revision=1, analysis_context=context,
    ))
    latest = reopen(client, updated['dataset_id'])
    assert latest['dataset']['revision'] == 2
    assert edited['object_id'] in latest['identity_map']['object_ids']
    assert latest['analysis_context']['source_ids'] == [left, right]
    assert get_workspace(workspace_id) == workspace
    assert execute_analysis_context(context)['dataframe']['orders.total'].tolist() == [12, 8, 3]

    Path(get_source_private_locator(right)['path']).write_bytes(b'buyer,total\n1,99\n')
    failure = client.post(f"/api/datahub/datasets/{saved['dataset_id']}/open", json={})
    assert failure.status_code == 409
    assert failure.get_json()['error']['code'] == 'saved_dataset_dependency_changed'
    stale_analysis = client.post('/api/analytics/query', json={
        'source': {'kind': 'workspace', 'analysis_context': context}, 'query': {},
    })
    assert stale_analysis.status_code == 400
    assert stale_analysis.get_json()['code'] == 'saved_dataset_dependency_changed'


def test_legacy_activation_is_compatible_and_missing_bytes_are_reported(app, tmp_path):
    client = app.test_client()
    registered_file = tmp_path / 'manual.csv'
    registered_file.write_bytes(b'id,value\n1,5\n')
    registered = client.post('/api/datahub/register', json={'id': 'manual', 'name': 'Manual', 'path': str(registered_file)})
    assert registered.status_code == 201, registered.get_json()
    opened = reopen(client, 'manual')
    assert opened['analysis_context']['source_ids'] == ['manual']
    assert reopen(client, 'manual')['workspace'] == opened['workspace']
    registered_file.unlink()
    refusal = client.post('/api/datahub/datasets/manual/open')
    assert refusal.status_code == 409
    assert refusal.get_json()['error']['code'] == 'source_unavailable'


def test_legacy_multiple_primary_candidates_and_blocked_access_are_explicit(app, tmp_path):
    client = app.test_client()
    upload_data = upload(client, b'id,units\n1,5\n')
    managed_id = upload_data['source']['source_id']
    path = tmp_path / 'ambiguous.csv'
    path.write_bytes(b'id,units\n1,5\n')
    source_id = 'ambiguous'
    assert client.post('/api/datahub/register', json={'id': source_id, 'name': 'Ambiguous', 'path': str(path)}).status_code == 201
    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.executemany('''
            INSERT INTO data_workspaces (workspace_id, name, version, primary_source_id, created_at, updated_at)
            VALUES (?, 'Alternate', 1, ?, 'time', 'time')
        ''', [('ws_first', source_id), ('ws_second', source_id)])
        conn.executemany('''
            INSERT INTO workspace_sources (workspace_id, source_id, alias, role, added_at)
            VALUES (?, ?, 'alternate', 'primary', 'time')
        ''', [('ws_first', source_id), ('ws_second', source_id)])
    ambiguous = client.post(f'/api/datahub/datasets/{source_id}/open')
    assert ambiguous.status_code == 409
    assert ambiguous.get_json()['error']['code'] == 'ambiguous_dataset_workspace'
    assert client.post('/api/datahub/register', json={'id': managed_id, 'name': 'Replacement', 'path': 'missing.csv'}).status_code == 409

    blocked_path = tmp_path / 'blocked.csv'
    blocked_path.write_bytes(b'id,value\n1,5\n')
    response = client.post('/api/datahub/register', json={
        'id': 'blocked', 'name': 'Blocked', 'path': str(blocked_path), 'governance_policy': {'required_fields': ['missing']},
    })
    assert response.status_code == 201
    blocked = client.post('/api/datahub/datasets/blocked/open')
    assert blocked.status_code == 422
    assert blocked.get_json()['governance_readiness']['status'] == 'blocked'
    assert set(blocked.get_json()) == {'error', 'governance_readiness'}


def test_failed_save_rolls_back_workspace_and_receipt(app):
    client = app.test_client()
    uploaded = upload(client, b'id,units\n1,5\n')
    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.execute('''
            CREATE TRIGGER refuse_save AFTER INSERT ON saved_dataset_operations
            BEGIN SELECT RAISE(FAIL, 'test write failure'); END
        ''')
    payload = save_request(uploaded['workspace'], 'failed-save')
    response = client.post('/api/datahub/saved-datasets', json=payload)
    assert response.status_code == 500, response.get_json()
    with closing(backend_db.get_db_connection()) as conn, conn:
        assert conn.execute('SELECT COUNT(*) FROM dataset_activation_workspaces').fetchone()[0] == 0
        assert conn.execute('SELECT COUNT(*) FROM saved_datasets').fetchone()[0] == 0
        conn.execute('DROP TRIGGER refuse_save')
    assert save(client, **payload)['revision'] == 1


def test_refine_save_updates_named_upload_with_all_rows_lineage_and_applicable_object(app):
    client = app.test_client()
    raw = b'id,units\n' + b''.join(f'{index},{index * 3}\n'.encode() for index in range(1, 232))
    uploaded = upload(client, raw)
    original_source = uploaded['source']
    saved = save(client, **save_request(uploaded['workspace'], 'initial'))
    opened = reopen(client, saved['dataset_id'])
    original_analysis = opened['analysis_context']
    active_workspace = opened['workspace']
    object_record = business_objects.create_business_object(active_workspace['workspace_id'], {
        'display_name': 'Item', 'source_id': original_source['source_id'], 'record_key_field': 'id', 'relationship_ids': [],
    })
    steps = [
        {'type': 'rename_columns', 'params': {'mappings': {'units': 'quantity'}}},
        {'type': 'filter_rows', 'params': {'conditions': [{'column': 'id', 'operator': 'gte', 'value': '25'}]}},
    ]
    preview_payload = {'workspace_id': active_workspace['workspace_id'], 'workspace_version': active_workspace['version'],
                       'source_id': original_source['source_id'], 'steps': steps}
    rejected = client.post('/api/datahub/refine-preview', json={**preview_payload, 'steps': [
        {'type': 'remove_columns', 'params': {'columns': ['id']}},
    ]})
    assert rejected.get_json()['error']['object_ids'] == [object_record['object_id']]
    preview = client.post('/api/datahub/refine-preview', json=preview_payload)
    assert preview.status_code == 200, preview.get_json()
    assert preview.get_json()['row_count'] == 207
    assert len(preview.get_json()['preview']) == 100
    assert len(list(workspace_context.MANAGED_UPLOAD_ROOT.iterdir())) == 1


    updated_request = save_request(active_workspace, 'refined-update', kind='refined', steps=steps,
                                   source_fingerprint=preview.get_json()['source_fingerprint'],
                                   dataset_id=saved['dataset_id'], expected_revision=1)
    updated = save(client, **updated_request)
    assert save(client, **updated_request) == updated
    assert updated['kind'] == 'refined'
    assert updated['revision'] == 2
    assert updated['lineage'] == {'parent_source_id': original_source['source_id'],
                                   'parent_content_fingerprint': original_source['content_fingerprint'],
                                   'parent_schema_version': original_source['schema_version']}
    assert updated['primary_source_id'] != original_source['source_id']
    assert len(list(workspace_context.MANAGED_UPLOAD_ROOT.iterdir())) == 2

    latest = reopen_in_new_process(saved['dataset_id'], limit=200)
    tail = reopen(app.test_client(), saved['dataset_id'], offset=200, expected_revision=2)
    rows = latest['preview'] + tail['preview']
    assert rows == [{'id': index, 'quantity': index * 3} for index in range(25, 232)]
    assert latest['row_count'] == 207
    assert latest['analysis_context']['source_ids'] == [updated['primary_source_id']]
    assert latest['identity_map']['object_ids'][object_record['object_id']]
    restored = business_objects.list_business_objects(latest['workspace']['workspace_id'])
    assert restored[0]['source_id'] == updated['primary_source_id']
    assert restored[0]['configuration_error'] is None
    assert execute_analysis_context(original_analysis)['dataframe']['units'].tolist() == [index * 3 for index in range(1, 232)]
    assert Path(get_source_private_locator(original_source['source_id'])['path']).read_bytes() == raw


def test_working_refine_stays_private_until_explicit_save_and_reopens_in_full(app):
    client = app.test_client()
    raw = b'id,units\n' + b''.join(f'{index},{index * 3}\n'.encode() for index in range(1, 232))
    uploaded = upload(client, raw)
    workspace = uploaded['workspace']
    apply_request = {
        'workspace_id': workspace['workspace_id'], 'workspace_version': workspace['version'],
        'source_id': workspace['primary_source_id'], 'request_id': 'refine-draft',
        'steps': [{'type': 'rename_columns', 'params': {'mappings': {'units': 'quantity'}}}],
    }
    applied = client.post('/api/datahub/refine-working', json=apply_request)
    assert applied.status_code == 200, applied.get_json()
    edit = applied.get_json()
    assert len(edit['full_data']) == 231
    assert edit['full_data'][-1] == {'id': 231, 'quantity': 693}
    assert client.post('/api/datahub/refine-working', json=apply_request).get_json()['workspace'] == edit['workspace']
    assert client.get('/api/datahub/datasets').get_json() == {'datasets': []}
    saved = save(client, **save_request(edit['workspace'], 'save-refined-draft', kind='current'))
    assert saved['kind'] == 'refined'
    assert saved['lineage']['parent_source_id'] == workspace['primary_source_id']
    assert reopen_in_new_process(saved['dataset_id'])['full_data'] == edit['full_data']
    assert client.delete('/api/datahub').get_json() == {'deleted_count': 1}
    assert client.get('/api/datahub/datasets').get_json() == {'datasets': []}
    assert execute_analysis_context(edit['analysis_context'])['dataframe']['quantity'].tolist()[-1] == 693


def test_refined_save_rolls_back_file_and_catalog_record_and_detects_preview_drift(app, tmp_path):
    client = app.test_client()
    path = tmp_path / 'manual.csv'
    path.write_bytes(b'id,value\n1,5\n')
    client.post('/api/datahub/register', json={'id': 'manual', 'name': 'Manual', 'path': str(path)})
    workspace = reopen(client, 'manual')['workspace']
    steps = [{'type': 'rename_columns', 'params': {'mappings': {'value': 'units'}}}]
    preview = client.post('/api/datahub/refine-preview', json={
        'workspace_id': workspace['workspace_id'], 'workspace_version': workspace['version'], 'source_id': 'manual', 'steps': steps,
    }).get_json()
    payload = save_request(workspace, 'refined', kind='refined', steps=steps, source_fingerprint=preview['source_fingerprint'])
    path.write_bytes(b'id,value\n1,6\n')
    stale = client.post('/api/datahub/saved-datasets', json=payload)
    assert stale.status_code == 409
    assert stale.get_json()['error']['code'] == 'saved_dataset_dependency_changed'
    path.write_bytes(b'id,value\n1,5\n')
    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.execute('''
            CREATE TRIGGER refuse_refine AFTER INSERT ON saved_dataset_operations
            BEGIN SELECT RAISE(FAIL, 'test write failure'); END
        ''')
    assert client.post('/api/datahub/saved-datasets', json=payload).status_code == 500
    assert not list(workspace_context.MANAGED_UPLOAD_ROOT.iterdir())
    with closing(backend_db.get_db_connection()) as conn, conn:
        assert conn.execute('SELECT COUNT(*) FROM datahub_datasets').fetchone()[0] == 1
        assert conn.execute('SELECT COUNT(*) FROM saved_datasets').fetchone()[0] == 0
        assert conn.execute('SELECT COUNT(*) FROM saved_dataset_derivations').fetchone()[0] == 0
        conn.execute('DROP TRIGGER refuse_refine')
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: app.test_client().post('/api/datahub/saved-datasets', json=payload), range(2)))
    assert sorted(response.status_code for response in responses) == [200, 201]
    assert responses[0].get_json()['dataset'] == responses[1].get_json()['dataset']
    assert len(list(workspace_context.MANAGED_UPLOAD_ROOT.iterdir())) == 1
