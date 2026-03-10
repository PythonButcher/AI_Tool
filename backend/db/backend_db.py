import sqlite3
from threading import Lock


DB_PATH = 'backend/db/database.db'
_SCHEMA_LOCK = Lock()
_SCHEMA_READY = False


def _ensure_schema(conn):
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS datahub_datasets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            uploadedAt TEXT,
            numRows INTEGER DEFAULT 0,
            numCols INTEGER DEFAULT 0,
            schema_json TEXT,
            preview_json TEXT,
            semantic_model_json TEXT
        )
        '''
    )

    existing_columns = {
        row[1]
        for row in conn.execute('PRAGMA table_info(datahub_datasets)').fetchall()
    }
    if 'semantic_model_json' not in existing_columns:
        conn.execute('ALTER TABLE datahub_datasets ADD COLUMN semantic_model_json TEXT')

    conn.commit()


def get_db_connection():
    global _SCHEMA_READY

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    if not _SCHEMA_READY:
        with _SCHEMA_LOCK:
            if not _SCHEMA_READY:
                _ensure_schema(conn)
                _SCHEMA_READY = True

    return conn
