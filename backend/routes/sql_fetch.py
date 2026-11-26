from flask import Blueprint, jsonify, request
import os
import sqlite3

import pandas as pd
import psycopg
from dotenv import load_dotenv
from psycopg import sql
from psycopg.rows import dict_row

from backend.repositories.source_workspace_repository import list_sql_workspaces
from backend.services.postgres_workspace import (
    PostgresWorkspaceError, _connection_config, discover_databases, discover_tables, import_workspace, open_workspace,
)
from backend.services.semantic_model import infer_semantic_model_from_dataframe
from backend.services.workspace_context import WorkspaceContextError
from backend.utils.global_state import set_semantic_model, set_uploaded_df

load_dotenv()

sql_fetch_bp = Blueprint('sql_fetch_bp', __name__)

DB_CONFIG = {
    'dbname': 'movies_db',
    'user': 'postgres',
    'password': os.getenv('POSTGRES_PASSWORD', ''),
    'host': 'localhost',
    'port': 5432,
}


def get_db_connection(config=None):
    try:
        conn_config = _connection_config(DB_CONFIG if config is None else config)
        conn = psycopg.connect(**conn_config, row_factory=dict_row)
        conn.read_only = True
        return conn
    except (psycopg.Error, ValueError):
        return None


def _postgres_response(operation, *args, status=200):
    try:
        return jsonify(operation(*args)), status
    except PostgresWorkspaceError as error:
        result = {'error': {'code': error.code, 'message': str(error)}}
        if error.readiness:
            result['governance_readiness'] = error.readiness
        return jsonify(result), error.status
    except (OSError, sqlite3.Error, WorkspaceContextError):
        return jsonify({'error': {'code': 'postgres_storage_unavailable',
                                  'message': 'Unable to access managed PostgreSQL snapshot storage.'}}), 500


@sql_fetch_bp.post('/api/postgres/databases')
def postgres_databases():
    return _postgres_response(discover_databases, request.get_json(silent=True))


@sql_fetch_bp.post('/api/postgres/tables')
def postgres_tables():
    return _postgres_response(discover_tables, request.get_json(silent=True))


@sql_fetch_bp.post('/api/postgres/workspaces')
def postgres_import():
    return _postgres_response(import_workspace, request.get_json(silent=True), status=201)


@sql_fetch_bp.get('/api/postgres/workspaces')
def postgres_saved_workspaces():
    return jsonify({'workspaces': list_sql_workspaces()})


@sql_fetch_bp.post('/api/postgres/workspaces/<workspace_id>/open')
def postgres_open_workspace(workspace_id):
    return _postgres_response(open_workspace, workspace_id)


@sql_fetch_bp.route('/api/db/connect', methods=['POST'])
def connect_with_credentials():
    data = request.json or {}

    config = {
        'host': data.get('host'),
        'port': data.get('port', 5432),
        'dbname': data.get('dbname'),
        'user': data.get('user'),
        'password': data.get('password'),
    }

    conn = get_db_connection(config)
    if not conn:
        return jsonify({'error': 'Connection failed. Check your credentials.'}), 400

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                '''
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public';
                '''
            )
            tables = cursor.fetchall()
        return jsonify({'tables': tables}), 200
    except psycopg.Error:
        return jsonify({'error': 'Failed to fetch tables'}), 500
    finally:
        conn.close()


@sql_fetch_bp.route('/api/preview', methods=['POST'])
def preview_table_route():
    data = request.json or {}
    table_name = data.get('table')
    limit = data.get('limit', 100)
    db_config = data.get('dbConfig')

    if not isinstance(table_name, str) or not table_name:
        return jsonify({'error': 'Missing table parameter'}), 400
    if type(limit) is not int or not 1 <= limit <= 1000:
        return jsonify({'error': 'Preview limit must be an integer between 1 and 1000.'}), 400
    if not isinstance(db_config, dict):
        return jsonify({'error': 'PostgreSQL connection settings are required.'}), 400

    result, status = get_table_preview(table_name, limit, db_config)
    return jsonify(result), status


def get_table_names():
    conn = get_db_connection()
    if not conn:
        return {'error': 'Failed to connect to the database'}, 500

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                '''
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public';
                '''
            )
            tables = cursor.fetchall()
        return {'tables': tables}, 200
    except psycopg.Error:
        return {'error': 'Failed to fetch tables'}, 500
    finally:
        conn.close()


def get_table_preview(table_name, limit=100, config=None):
    conn = get_db_connection(config)
    if not conn:
        return {'error': 'Failed to connect to the table'}, 500

    try:
        with conn.cursor() as cursor:
            query = sql.SQL('SELECT * FROM {} LIMIT %s').format(sql.Identifier('public', table_name))
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
        dataframe = pd.DataFrame(rows)
        set_uploaded_df(dataframe)
        semantic_model = infer_semantic_model_from_dataframe(
            dataframe,
            dataset_name=table_name,
            source='database_preview',
        )
        set_semantic_model(semantic_model)

        preview_rows = rows[:5] if isinstance(rows, list) else rows
        return {
            'data_preview': preview_rows,
            'full_data': rows,
            'semantic_model': semantic_model,
        }, 200
    except (psycopg.Error, ValueError, TypeError):
        return {'error': 'Failed to preview the table.'}, 500
    finally:
        conn.close()


if __name__ == '__main__':
    result, status = get_table_names()
    print(f'Status: {status}')
    print('Tables:', result)
