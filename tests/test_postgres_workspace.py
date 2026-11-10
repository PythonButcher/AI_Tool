"""Verify projected PostgreSQL snapshots through the governed HTTP workflow."""

from io import BytesIO
import os
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from uuid import uuid4

from flask import Flask
import psycopg
from psycopg import sql

from backend.db import backend_db
from backend.repositories import source_workspace_repository
from backend.routes.datahub_routes import datahub_bp
from backend.routes.data_workspaces import data_workspaces_bp
from backend.routes.decision_chat import decision_chat_bp
from backend.routes.ml_studio import ml_studio_bp
from backend.routes.semantic_metrics import semantic_metrics_bp
from backend.routes.source_relationships import source_relationships_bp
from backend.routes.sql_fetch import sql_fetch_bp
from backend.routes.upload import upload_bp
from backend.services import postgres_workspace, workspace_context
from backend.services.dataset_context import load_datahub_dataset


def app_client(storage=None):
    app = Flask(__name__)
    app.config['TESTING'] = True
    if storage is not None:
        app.config.update(ML_STUDIO_DATABASE_PATH=storage / 'ml.sqlite', ML_STUDIO_ARTIFACT_ROOT=storage / 'artifacts')
        app.register_blueprint(ml_studio_bp)
    for blueprint in (sql_fetch_bp, datahub_bp, data_workspaces_bp, decision_chat_bp,
                      semantic_metrics_bp, source_relationships_bp, upload_bp):
        app.register_blueprint(blueprint)
    return app.test_client()


class PostgresRequestTests(unittest.TestCase):
    def test_invalid_selection_and_preview_limit_are_rejected_before_connecting(self):
        client = app_client()
        with patch.object(psycopg, 'connect', side_effect=AssertionError('Unexpected connection')):
            response = client.post('/api/postgres/workspaces', json={
                'name': 'Orders', 'tables': [{'schema': 'public', 'table': 'orders', 'columns': ['id', 'id']}],
            })
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json['error']['code'], 'invalid_postgres_request')
            self.assertEqual(client.post('/api/preview', json={'table': 'orders', 'limit': None}).status_code, 400)

    def test_connection_failures_are_redacted(self):
        with patch.object(psycopg, 'connect', side_effect=psycopg.OperationalError('secret detail')):
            response = app_client().post('/api/postgres/databases', json={
                'host': '127.0.0.1', 'user': 'fixture', 'password': 'secret detail',
            })
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json['error']['code'], 'postgres_connect_failed')
        self.assertNotIn('secret detail', response.get_data(as_text=True))


@unittest.skipUnless(os.getenv('AI_TOOL_DISPOSABLE_PG_PORT'), 'Requires an explicitly disposable loopback PostgreSQL cluster')
class PostgresWorkspaceIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        port = int(os.environ['AI_TOOL_DISPOSABLE_PG_PORT'])
        token = uuid4().hex
        database, reader = f'pg_review_{token}', f'fixture_reader_{token}'
        admin = {'host': '127.0.0.1', 'port': port, 'dbname': 'postgres', 'user': 'pgfixture', 'connect_timeout': 5}
        with psycopg.connect(**admin, autocommit=True) as conn:
            conn.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(database)))
            conn.execute(sql.SQL('CREATE ROLE {} LOGIN').format(sql.Identifier(reader)))
            conn.execute(sql.SQL('ALTER ROLE {} SET default_transaction_read_only = on').format(sql.Identifier(reader)))
        with psycopg.connect(**{**admin, 'dbname': database}) as conn:
            conn.execute('CREATE SCHEMA sales')
            conn.execute('CREATE TABLE sales.orders (id bigint, customer_id bigint, revenue numeric(12, 2), internal_note text, paid boolean, ordered_at timestamptz)')
            conn.execute("""INSERT INTO sales.orders VALUES
                (9223372036854775806, 1, 10, 'private', true, '2026-01-01 12:00+00'),
                (2, 2, 25, 'private', null, null), (3, null, 40, 'private', false, null)""")
            conn.execute('CREATE TABLE sales."Customer List" (id bigint, segment text)')
            conn.execute("INSERT INTO sales.\"Customer List\" VALUES (1,'Retail'), (2,'Enterprise')")
            conn.execute('CREATE TABLE sales.unrelated (revenue integer)')
            conn.execute('INSERT INTO sales.unrelated VALUES (9000)')
            conn.execute('CREATE TABLE sales.hidden (id int)')
            conn.execute(sql.SQL('GRANT USAGE ON SCHEMA sales TO {}').format(sql.Identifier(reader)))
            conn.execute(sql.SQL('GRANT SELECT (id, customer_id, revenue, paid, ordered_at) ON sales.orders TO {}').format(sql.Identifier(reader)))
            conn.execute(sql.SQL('GRANT SELECT ON sales."Customer List", sales.unrelated TO {}').format(sql.Identifier(reader)))
        cls.settings = {'host': admin['host'], 'port': port, 'dbname': database, 'user': reader, 'sslmode': 'disable'}

    def setUp(self):
        tmp = self.enterContext(TemporaryDirectory())
        self.enterContext(patch.object(backend_db, 'DB_PATH', str(Path(tmp) / 'catalog.sqlite')))
        self.enterContext(patch.object(backend_db, '_SCHEMA_READY', False))
        self.storage = Path(tmp) / 'snapshots'
        self.app_storage = Path(tmp)
        self.enterContext(patch.object(workspace_context, 'MANAGED_UPLOAD_ROOT', self.storage))
        self.enterContext(patch.object(postgres_workspace, 'set_uploaded_df'))
        self.enterContext(patch.object(postgres_workspace, 'set_semantic_model'))
        self.enterContext(patch.object(postgres_workspace, 'set_governance_state'))
        self.enterContext(patch('backend.services.chat_model_router._create_client', side_effect=AssertionError('Unexpected model call')))
        self.client = app_client(self.app_storage)
        self.orders = {'schema': 'sales', 'table': 'orders'}
        self.customers = {'schema': 'sales', 'table': 'Customer List'}
        self.payload = {
            'connection': self.settings,
            'name': 'Sales model',
            'tables': [self.customers, {**self.orders, 'columns': ['id', 'customer_id', 'revenue', 'paid', 'ordered_at']}],
            'primary': self.orders,
        }

    def request(self, method, url, status=200, **kwargs):
        response = self.client.open(url, method=method, **kwargs)
        self.assertEqual(response.status_code, status, response.json)
        return response.json

    def chat(self, workspace_id, message, expected):
        body = self.request('POST', '/api/decision/chat/turns', json={
            'user_message': message, 'workspace_id': workspace_id, 'model_mode': 'auto', 'requested_mode': 'explore',
            'dataset': [{'revenue': 9999}],
        })
        self.assertEqual(body['model_routing']['selected_mode'], 'local')
        self.assertIsNone(body['model_routing']['attempted_model'])
        answer = next(artifact for artifact in body['artifacts'] if artifact['type'] == 'answer')
        self.assertEqual(answer['content']['summary']['value'], expected)
        return body, answer

    def test_discover_import_relationship_and_reopen_without_connection(self):
        catalog = self.request('POST', '/api/postgres/databases', json=self.settings)
        self.assertIn(self.settings['dbname'], catalog['databases'])
        tables = self.request('POST', '/api/postgres/tables', json=self.settings)['tables']
        self.assertEqual({item['table'] for item in tables}, {'orders', 'Customer List', 'unrelated'})
        orders_metadata = next(item for item in tables if item['table'] == 'orders')
        self.assertEqual([item['name'] for item in orders_metadata['columns']], ['id', 'customer_id', 'revenue', 'paid', 'ordered_at'])
        old = self.request('POST', '/api/upload', data={'file': (BytesIO(b'id,revenue\n1,1000\n'), 'old.csv')})
        saved = self.request('POST', '/api/postgres/workspaces', 201, json=self.payload)
        workspace, primary = saved['workspace'], saved['source']
        workspace_id, left_id, right_id = workspace['workspace_id'], primary['source_id'], saved['sources'][1]['source_id']
        self.assertNotEqual(workspace_id, old['workspace']['workspace_id'])
        self.assertEqual(workspace['primary_source_id'], left_id)
        self.assertEqual([item['source_kind'] for item in saved['sources']], ['sql', 'sql'])
        self.assertEqual(primary['semantic_model']['dataset']['id'], left_id)
        self.assertEqual(saved['full_data'][0]['id'], '9223372036854775806')
        self.assertEqual(load_datahub_dataset(left_id)['dataframe'].iloc[0]['id'], 9223372036854775806)
        self.assertIsNone(saved['full_data'][1]['paid'])
        self.assertIn('2026-01-01T12:00:00', saved['full_data'][0]['ordered_at'])
        self.assertEqual(saved['analysis_context']['source_ids'], [left_id])
        self.assertEqual(saved['analysis_context']['workspace_version'], workspace['version'])
        self.assertNotIn('internal_note', str(saved))
        self.assertNotIn(self.settings['user'], str(saved))
        self.assertNotIn('private_path', str(saved))
        self.assertEqual(len(list(self.storage.glob('*.table.json'))), 2)

        with psycopg.connect(**self.settings) as conn:
            inner = conn.execute('SELECT sum(revenue) FROM sales.orders o JOIN sales."Customer List" c ON o.customer_id = c.id').fetchone()[0]
            left = conn.execute('SELECT sum(revenue) FROM sales.orders o LEFT JOIN sales."Customer List" c ON o.customer_id = c.id').fetchone()[0]
            retail = conn.execute('SELECT sum(revenue) FROM sales.orders o JOIN sales."Customer List" c ON o.customer_id = c.id WHERE c.segment = %s', ('Retail',)).fetchone()[0]
        self.assertEqual((inner, left, retail), (35, 75, 10))

        # From this point all operations must resolve the saved snapshots.
        with patch.object(psycopg, 'connect', side_effect=AssertionError('Snapshot reconnected')):
            current, _ = self.chat(workspace_id, 'Show total revenue', 75)
            self.assertEqual(current['analysis_context']['relationship_ids'], [])
            base = f'/api/data-workspaces/{workspace_id}/relationships'
            relation = self.request('POST', base, 201, json={
                'left_source_id': left_id, 'right_source_id': right_id,
                'field_pairs': [{'left_field': 'customer_id', 'right_field': 'id'}],
                'cardinality': 'many_to_one', 'join_behavior': 'inner',
            })['relationship']
            path = f'{base}/{relation["relationship_id"]}'
            validated = self.request('POST', f'{path}/validate')['relationship']
            self.assertEqual(validated['validation_state'], 'valid')
            self.assertFalse(validated['is_active'])
            active = self.request('PATCH', path, json={
                'version': validated['version'], 'is_confirmed': True, 'is_active': True,
            })['relationship']
            self.assertTrue(active['is_active'])
            self.chat(workspace_id, 'Show total revenue', inner)
            updated = self.request('PATCH', path, json={'version': active['version'], 'join_behavior': 'left'})['relationship']
            active = self.request('PATCH', path, json={
                'version': updated['version'], 'is_confirmed': True, 'is_active': True,
            })['relationship']
            self.chat(workspace_id, 'Show total revenue', left)

            self.client = app_client(self.app_storage)
            self.assertEqual([item['workspace_id'] for item in self.request('GET', '/api/postgres/workspaces')['workspaces']], [workspace_id])
            reopened = self.request('POST', f'/api/postgres/workspaces/{workspace_id}/open')
            self.assertEqual(reopened['workspace']['workspace_id'], workspace_id)
            self.assertGreater(reopened['workspace']['version'], workspace['version'])
            self.assertEqual(reopened['full_data'], saved['full_data'])
            records = self.request('GET', '/api/datahub/list')
            self.assertNotIn('path', next(item for item in records if item['id'] == left_id))
            rows = self.request('POST', '/api/datahub/fetch_rows', json={'dataset_ids': [right_id]})['datasets'][right_id]['data']
            self.assertEqual({row['segment'] for row in rows}, {'Retail', 'Enterprise'})
            turn, answer = self.chat(workspace_id, 'Show total revenue for Retail segment', retail)
            self.assertEqual(turn['analysis_context']['source_ids'], [left_id, right_id])
            self.assertEqual(turn['analysis_context']['workspace_version'], reopened['workspace']['version'])
            self.assertEqual(turn['analysis_context']['relationship_ids'], [active['relationship_id']])
            lineage = turn['analysis_lineage']
            self.assertEqual(lineage, answer['analysis_lineage'])
            self.assertEqual(lineage['relationships'][0]['source_fingerprints'], active['source_fingerprints'])
            self.assertEqual(answer['content']['filters'][0]['value'], 'Retail')
            metric = self.request('POST', '/api/semantic-metrics/resolve', json={
                'dataset_ref': {'source': 'datahub', 'dataset_id': left_id},
                'metric_id': next(item['id'] for item in primary['semantic_model']['metrics']
                                  if item['expression'].get('column') == 'revenue'),
            })
            self.assertEqual(metric['summary']['value'], left)
            ml_input = {key: turn['analysis_context'][key] for key in
                        ('workspace_id', 'workspace_version', 'source_ids', 'relationship_ids')}
            ml_snapshot = self.request('POST', '/api/ml-studio/v1/snapshots', 201, json=ml_input)['snapshot']
            self.assertEqual(ml_snapshot['source_ids'], [left_id, right_id])
            self.assertEqual(ml_snapshot['relationship_ids'], [active['relationship_id']])
            self.assertEqual(self.request('POST', '/api/datahub/register', 409, json={'id': left_id, 'name': 'Overwrite', 'path': 'wrong.csv'})['error'],
                             'A managed PostgreSQL source cannot be overwritten through path registration.')

    def test_denied_or_oversized_import_never_publishes_partial_sources(self):
        bad = {**self.payload, 'tables': [self.orders, {**self.customers, 'columns': ['unknown']}]}
        self.assertEqual(self.request('POST', '/api/postgres/workspaces', 422, json=bad)['error']['code'],
                         'postgres_selection_unavailable')
        with patch.object(postgres_workspace, 'MAX_ROWS', 3):
            self.assertEqual(self.request('POST', '/api/postgres/workspaces', 422, json=self.payload)['error']['code'],
                             'postgres_snapshot_limit')
        self.assertEqual(self.request('GET', '/api/data-sources')['sources'], [])
        self.assertEqual(self.request('GET', '/api/postgres/workspaces')['workspaces'], [])
        self.assertFalse(self.storage.exists())

    def test_catalog_failure_rolls_back_all_rows_and_snapshot_files(self):
        insert = source_workspace_repository._insert_membership

        def fail_lookup(connection, membership):
            if membership['role'] == 'lookup':
                raise sqlite3.IntegrityError('Simulated lookup insert failure')
            insert(connection, membership)

        with patch.object(source_workspace_repository, '_insert_membership', side_effect=fail_lookup):
            body = self.request('POST', '/api/postgres/workspaces', 500, json=self.payload)
        self.assertEqual(body['error']['code'], 'postgres_storage_unavailable')
        self.assertEqual(self.request('GET', '/api/data-sources')['sources'], [])
        self.assertEqual(self.request('GET', '/api/postgres/workspaces')['workspaces'], [])
        self.assertEqual(list(self.storage.iterdir()), [])
