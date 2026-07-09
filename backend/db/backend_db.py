import json
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
            semantic_model_json TEXT,
            governance_policy_json TEXT,
            governance_readiness_json TEXT
        )
        '''
    )

    existing_columns = {
        row[1]
        for row in conn.execute('PRAGMA table_info(datahub_datasets)').fetchall()
    }
    if 'semantic_model_json' not in existing_columns:
        conn.execute('ALTER TABLE datahub_datasets ADD COLUMN semantic_model_json TEXT')
    if 'governance_policy_json' not in existing_columns:
        conn.execute('ALTER TABLE datahub_datasets ADD COLUMN governance_policy_json TEXT')
    if 'governance_readiness_json' not in existing_columns:
        conn.execute('ALTER TABLE datahub_datasets ADD COLUMN governance_readiness_json TEXT')

    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS decision_assets (
            asset_id TEXT PRIMARY KEY,
            schema_version TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            decision_output_json TEXT NOT NULL,
            graph_state_json TEXT,
            dataset_label TEXT NOT NULL,
            readiness_state TEXT NOT NULL,
            truth_boundary TEXT NOT NULL,
            archived_at TEXT
        )
        '''
    )
    decision_asset_columns = {
        row[1]
        for row in conn.execute('PRAGMA table_info(decision_assets)').fetchall()
    }
    if 'archived_at' not in decision_asset_columns:
        conn.execute('ALTER TABLE decision_assets ADD COLUMN archived_at TEXT')
    conn.execute(
        '''
        CREATE INDEX IF NOT EXISTS idx_decision_assets_created_at
        ON decision_assets (created_at DESC)
        '''
    )

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


def get_dataset_record(dataset_id):
    if not dataset_id:
        return None

    conn = get_db_connection()
    try:
        row = conn.execute(
            'SELECT * FROM datahub_datasets WHERE id = ?',
            (dataset_id,),
        ).fetchone()
        return row
    finally:
        conn.close()


def update_dataset_semantic_model(dataset_id, semantic_model):
    if not dataset_id:
        return False

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE datahub_datasets SET semantic_model_json = ? WHERE id = ?',
            (json.dumps(semantic_model) if semantic_model is not None else None, dataset_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()
