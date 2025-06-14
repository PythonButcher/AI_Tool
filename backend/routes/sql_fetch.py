from flask import Blueprint, jsonify, request
import psycopg
from psycopg.rows import dict_row
from psycopg import sql
import os
from dotenv import load_dotenv

load_dotenv()

sql_fetch_bp = Blueprint('sql_fetch_bp', __name__)

# Default static configuration (for local dev only)
DB_CONFIG = {
    'dbname': 'movies_db',
    'user': 'postgres',
    'password': os.getenv('POSTGRES_PASSWORD', ''),  # 🔐 Load from .env
    'host': 'localhost',
    'port': 5432
}


def get_db_connection(config=None):
    """Establish a psycopg3 connection using provided or default config."""
    try:
        conn_config = config if config else DB_CONFIG
        conn = psycopg.connect(**conn_config, row_factory=dict_row)
        return conn
    except Exception as e:
        print(f"❌ Error connecting to DB: {e}")
        return None


@sql_fetch_bp.route('/api/db/connect', methods=['POST'])
def connect_with_credentials():
    print("📥 Received request to /api/db/connect")

    data = request.json or {}

    config = {
        'host': data.get('host'),
        'port': data.get('port', 5432),
        'dbname': data.get('dbname'),         # ✅ FIXED: pull 'dbname' correctly
        'user': data.get('user'),
        'password': data.get('password')
    }

    conn = get_db_connection(config)
    if not conn:
        return jsonify({'error': 'Connection failed. Check your credentials.'}), 400

    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public';
            """)
            tables = cursor.fetchall()
        conn.close()
        return jsonify({'tables': tables}), 200
    except Exception as e:
        print(f"❌ Error fetching tables: {e}")
        return jsonify({'error': 'Failed to fetch tables'}), 500


@sql_fetch_bp.route('/api/preview', methods=['POST'])
def preview_table_route():
    data = request.json or {}
    table_name = data.get('table')
    limit = data.get('limit', 100)
    db_config = data.get('dbConfig')  # ✅ Expect full dbConfig sent from frontend

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
            cursor.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public';
            """)
            tables = cursor.fetchall()
        conn.close()
        return {'tables': tables}, 200
    except Exception as e:
        print(f"❌ Error fetching tables: {e}")
        return {'error': 'Failed to fetch tables'}, 500


def get_table_preview(table_name, limit=100, config=None):
    conn = get_db_connection(config)
    if not conn:
        return {'error': 'Failed to connect to the table'}, 500

    try:
        with conn.cursor() as cursor:
            query = sql.SQL("SELECT * FROM {} LIMIT %s").format(sql.Identifier(table_name))
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
        conn.close()
        return {'data_preview': rows}, 200
    except Exception as e:
        print(f"❌ Error previewing table '{table_name}': {e}")
        return {'error': f'Failed to preview table: {e}'}, 500


# CLI Testing
if __name__ == '__main__':
    print("🔍 Testing default DB connection:")
    result, status = get_table_names()
    print(f"Status: {status}")
    print("Tables:", result)
