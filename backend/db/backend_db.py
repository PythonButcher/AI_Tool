import json
import sqlite3
from threading import Lock


DB_PATH = 'backend/db/database.db'
_SCHEMA_LOCK = Lock()
_SCHEMA_READY = False


def _ensure_schema(conn):
    # Foreign-key enforcement is connection-local in SQLite. Enabling it here
    # protects workspace membership without changing callers of this module.
    conn.execute('PRAGMA foreign_keys = ON')
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
    source_columns = {
        'source_kind': "TEXT NOT NULL DEFAULT 'catalog'",
        'locator_kind': "TEXT NOT NULL DEFAULT 'legacy_path'",
        'locator_json': 'TEXT',
        'content_fingerprint': 'TEXT',
        'schema_version': 'INTEGER NOT NULL DEFAULT 1',
        'created_at': 'TEXT',
        'updated_at': 'TEXT',
    }
    for column_name, column_definition in source_columns.items():
        if column_name not in existing_columns:
            conn.execute(
                f'ALTER TABLE datahub_datasets ADD COLUMN {column_name} {column_definition}'
            )

    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS data_workspaces (
            workspace_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            primary_source_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (primary_source_id) REFERENCES datahub_datasets(id) ON DELETE SET NULL
        )
        '''
    )
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS workspace_sources (
            workspace_id TEXT NOT NULL,
            source_id TEXT NOT NULL,
            alias TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('primary', 'lookup', 'context')),
            position_json TEXT,
            added_at TEXT NOT NULL,
            PRIMARY KEY (workspace_id, source_id),
            UNIQUE (workspace_id, alias),
            FOREIGN KEY (workspace_id) REFERENCES data_workspaces(workspace_id) ON DELETE CASCADE,
            FOREIGN KEY (source_id) REFERENCES datahub_datasets(id) ON DELETE CASCADE
        )
        '''
    )
    conn.execute(
        '''
        CREATE INDEX IF NOT EXISTS idx_workspace_sources_source_id
        ON workspace_sources (source_id)
        '''
    )

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
    conn.execute('PRAGMA foreign_keys = ON')

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
