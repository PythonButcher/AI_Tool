from flask import Blueprint, jsonify, request
import os

import pandas as pd
import psycopg
from dotenv import load_dotenv
from psycopg import sql
from psycopg.rows import dict_row

from backend.services.semantic_model import infer_semantic_model_from_dataframe
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
        conn_config = config if config else DB_CONFIG
        conn = psycopg.connect(**conn_config, row_factory=dict_row)
        return conn
    except Exception as e:
        print(f'Error connecting to DB: {e}')
        return None


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
        conn.close()
        return jsonify({'tables': tables}), 200
    except Exception as e:
        print(f'Error fetching tables: {e}')
        return jsonify({'error': 'Failed to fetch tables'}), 500


@sql_fetch_bp.route('/api/preview', methods=['POST'])
def preview_table_route():
    data = request.json or {}
    table_name = data.get('table')
    limit = data.get('limit', 100)
    db_config = data.get('dbConfig')

    if not table_name:
        return jsonify({'error': 'Missing table parameter'}), 400

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
        conn.close()
        return {'tables': tables}, 200
    except Exception as e:
        print(f'Error fetching tables: {e}')
        return {'error': 'Failed to fetch tables'}, 500


def get_table_preview(table_name, limit=100, config=None):
    conn = get_db_connection(config)
    if not conn:
        return {'error': 'Failed to connect to the table'}, 500

    try:
        with conn.cursor() as cursor:
            query = sql.SQL('SELECT * FROM {} LIMIT %s').format(sql.Identifier(table_name))
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
        conn.close()

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
    except Exception as e:
        print(f"Error previewing table '{table_name}': {e}")
        return {'error': f'Failed to preview table: {e}'}, 500


if __name__ == '__main__':
    result, status = get_table_names()
    print(f'Status: {status}')
    print('Tables:', result)
