"""Discover PostgreSQL data and publish selected projections as governed snapshots."""

from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal
from io import StringIO
import json
import math

import pandas as pd
import psycopg
from psycopg import sql
from psycopg.rows import dict_row

from backend.repositories.source_workspace_repository import get_source, get_workspace
from backend.services.data_catalog_lineage import evaluate_dataset_readiness, is_blocked
from backend.services.dataset_context import load_datahub_dataset, safe_json_records
from backend.services.semantic_model import infer_semantic_model_from_dataframe
from backend.services.workspace_context import build_analysis_context, register_managed_postgres_workspace
from backend.utils.global_state import set_governance_state, set_semantic_model, set_uploaded_df


MAX_TABLES = 12
MAX_COLUMNS = 100
MAX_ROWS = 50_000
MAX_CELLS = 1_000_000
MAX_BYTES = 32 * 1024 * 1024


class PostgresWorkspaceError(ValueError):
    def __init__(self, code, message, status=400, readiness=None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.readiness = readiness


def _invalid(message):
    return PostgresWorkspaceError("invalid_postgres_request", message)


def _over_budget():
    return PostgresWorkspaceError(
        "postgres_snapshot_limit", "Selection exceeds the snapshot budget. Choose fewer tables or columns, or import a smaller database view.", 422,
    )


def _connection_config(config, *, default_database=None):
    if not isinstance(config, dict):
        raise _invalid("Supply PostgreSQL connection settings.")
    host, user = config.get("host"), config.get("user")
    database = config.get("dbname") or default_database
    password = config.get("password", "")
    sslmode = config.get("sslmode", "prefer")
    if not all(isinstance(value, str) and value.strip() for value in (host, user, database)):
        raise _invalid("Supply a host, user and database name.")
    if any(char in host for char in ("/", "\\", ",")) or not isinstance(password, str):
        raise _invalid("Supply a single PostgreSQL host and a valid password value.")
    if sslmode not in ("prefer", "require", "verify-full", "disable"):
        raise _invalid("Choose a supported PostgreSQL SSL mode.")
    port = config.get("port")
    if port is None or port == "":
        port = 5432
    if not str(port).isascii() or not str(port).isdigit() or len(str(port)) > 5 or not 1 <= int(port) <= 65535:
        raise _invalid("Port must be between 1 and 65535.")
    return {"host": host.strip(), "port": int(port), "dbname": database, "user": user,
            "password": password, "sslmode": sslmode, "connect_timeout": 5}


@contextmanager
def _reader(config):
    try:
        connection = psycopg.connect(**config, row_factory=dict_row)
    except (psycopg.Error, ValueError) as exc:
        raise PostgresWorkspaceError("postgres_connect_failed", "Could not connect to PostgreSQL. Check the host, database, credentials and SSL settings.", 502) from exc
    try:
        with connection:
            connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            connection.execute("SET LOCAL statement_timeout = '15s'")
            connection.execute("SET LOCAL lock_timeout = '3s'")
            connection.execute("SET LOCAL TIME ZONE 'UTC'")
            yield connection
    except psycopg.errors.InsufficientPrivilege as exc:
        raise PostgresWorkspaceError("postgres_access_denied", "The PostgreSQL user lacks read access to the selection.", 403) from exc
    except psycopg.Error as exc:
        raise PostgresWorkspaceError("postgres_read_failed", "PostgreSQL could not read the selection. Refresh the database schema and check connectivity and permissions.", 502) from exc


def discover_databases(settings):
    config = _connection_config(settings, default_database="postgres")
    with _reader(config) as connection:
        rows = connection.execute(
            """SELECT datname AS name FROM pg_catalog.pg_database
               WHERE datallowconn AND NOT datistemplate
                 AND pg_catalog.has_database_privilege(oid, 'CONNECT')
               ORDER BY datname"""
        ).fetchall()
    return {"databases": [row["name"] for row in rows]}


def _readable_tables(connection, selection=None):
    clause = sql.SQL("")
    params = None
    if selection:
        clause = sql.SQL("AND (n.nspname, c.relname) IN ({})").format(
            sql.SQL(", ").join(sql.SQL("(%s, %s)") for _ in selection)
        )
        params = [name for key in selection for name in key]
    columns = connection.execute(sql.SQL(
        """SELECT n.nspname AS schema, c.relname AS table, a.attname AS name,
                  pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
           FROM pg_catalog.pg_class c
           JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
           WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f') AND a.attnum > 0 AND NOT a.attisdropped
             AND n.nspname <> 'information_schema' AND left(n.nspname, 3) <> 'pg_'
             AND pg_catalog.has_schema_privilege(n.oid, 'USAGE')
             AND pg_catalog.has_column_privilege(c.oid, a.attnum, 'SELECT')
             {}
           ORDER BY n.nspname, c.relname, a.attnum
           LIMIT 10001"""
    ).format(clause), params).fetchall()
    if len(columns) > 10_000:
        raise PostgresWorkspaceError("postgres_schema_limit", "This database exposes over 10,000 columns. Connect with a role that can read a narrower schema.", 422)
    tables = {}
    for column in columns:
        key = (column["schema"], column["table"])
        tables.setdefault(key, []).append({"name": column["name"], "data_type": column["data_type"]})
    return tables


def discover_tables(settings):
    config = _connection_config(settings)
    with _reader(config) as connection:
        tables = _readable_tables(connection)
    return {"database": config["dbname"], "tables": [
        {"schema": schema, "table": table, "columns": columns}
        for (schema, table), columns in tables.items()
    ], "limits": {"tables": MAX_TABLES, "columns_per_table": MAX_COLUMNS, "rows": MAX_ROWS,
                  "cells": MAX_CELLS, "bytes": MAX_BYTES}}


def _table_key(value):
    if not isinstance(value, dict):
        raise _invalid("Identify each selected table by schema and table name.")
    schema, table = value.get("schema"), value.get("table")
    if not all(isinstance(name, str) and name and len(name) <= 255 for name in (schema, table)):
        raise _invalid("Identify each selected table by schema and table name.")
    return schema, table


def _parse_selection(payload):
    if not isinstance(payload, dict):
        raise _invalid("Supply connection settings and a workspace selection.")
    name = payload.get("name")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
        raise _invalid("Workspace name must contain 1 to 100 characters.")
    tables = payload.get("tables")
    if not isinstance(tables, list) or not 1 <= len(tables) <= MAX_TABLES:
        raise _invalid(f"Choose between 1 and {MAX_TABLES} tables.")
    selected = {}
    for item in tables:
        key = _table_key(item)
        if key in selected:
            raise _invalid("Select each table only once.")
        columns = item.get("columns")
        if columns is not None and (
            not isinstance(columns, list) or not 1 <= len(columns) <= MAX_COLUMNS
            or any(not isinstance(column, str) or not 1 <= len(column) <= 255 for column in columns)
            or len(set(columns)) != len(columns)
        ):
            raise _invalid(f"Choose between 1 and {MAX_COLUMNS} distinct columns or use all columns.")
        selected[key] = columns
    primary = _table_key(payload.get("primary"))
    if primary not in selected:
        raise _invalid("Choose the primary table from the selected tables.")
    return name.strip(), {primary: selected.pop(primary), **selected}


def _normalize_value(value):
    if value is None or isinstance(value, (str, bool, int, datetime)):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, (float, Decimal)):
        numeric = float(value)
        # The platform analyzes numeric fields as double precision. Refuse an
        # exact PostgreSQL decimal when that would silently change a join key.
        if math.isfinite(numeric) and (not isinstance(value, Decimal) or Decimal(format(numeric, ".15g")) == value):
            return numeric
        raise PostgresWorkspaceError("postgres_snapshot_type", "A numeric value exceeds snapshot precision. Use a PostgreSQL view to round the value or cast exact keys to text.", 422)
    if isinstance(value, (list, dict)):
        return json.dumps(value, default=str, ensure_ascii=False)
    if isinstance(value, bytes):
        return value.hex()
    return str(value)


def _frame(rows, columns):
    data = {}
    for column in columns:
        values = [row[column] for row in rows]
        example = next((value for value in values if value is not None), None)
        # Nullable integer keys must retain their exact values across storage.
        if type(example) is int:
            data[column] = pd.array(values, dtype="Int64")
        elif type(example) is bool:
            data[column] = pd.array(values, dtype="boolean")
        else:
            data[column] = values
    return pd.DataFrame(data)


def _snapshot(connection, table, columns, remaining_rows, remaining_bytes):
    name = ".".join(table)
    projection = sql.SQL(", ").join(map(sql.Identifier, columns))
    query = sql.SQL("SELECT {} FROM {} LIMIT %s").format(projection, sql.Identifier(*table))
    rows = []
    measured_bytes = 0
    with connection.cursor(name="ai_tool_snapshot") as cursor:
        cursor.itersize = 256
        cursor.execute(query, (remaining_rows + 1,))
        for row in cursor:
            if len(rows) == remaining_rows:
                raise _over_budget()
            record = {key: _normalize_value(value) for key, value in row.items()}
            measured_bytes += sum(len(value.encode("utf-8")) for value in record.values() if isinstance(value, str))
            if measured_bytes > remaining_bytes:
                raise _over_budget()
            rows.append(record)
    try:
        frame = _frame(rows, columns)
        encoded = frame.to_json(orient="table", index=False, date_format="iso", date_unit="ns", double_precision=15)
        frame = pd.read_json(StringIO(encoded), orient="table")
    except (ValueError, TypeError, OverflowError) as exc:
        raise PostgresWorkspaceError("postgres_snapshot_type", "Selected values could not be stored. Use a PostgreSQL view to normalize the column types.", 422) from exc
    data = encoded.encode("utf-8")
    if len(data) > remaining_bytes:
        raise _over_budget()
    readiness = evaluate_dataset_readiness(frame, None, operation="postgres_snapshot")
    if is_blocked(readiness):
        raise PostgresWorkspaceError("postgres_snapshot_blocked", f"The selection from {name} is blocked by dataset readiness.", 422, readiness)
    return {"table": table[1], "name": name, "dataframe": frame, "file_bytes": data,
            "readiness": readiness, "preview": safe_json_records(frame.head()),
            "semantic_model": infer_semantic_model_from_dataframe(frame, dataset_name=table[1], source="postgres_snapshot")}


def import_workspace(payload):
    name, selections = _parse_selection(payload)
    config = _connection_config(payload.get("connection"))
    remaining_rows, remaining_cells, remaining_bytes = MAX_ROWS, MAX_CELLS, MAX_BYTES
    snapshots = []
    with _reader(config) as connection:
        readable = _readable_tables(connection, selections)
        for table, projected in selections.items():
            available = [item["name"] for item in readable.get(table, [])]
            columns = available if projected is None else projected
            if not columns or not set(columns).issubset(available):
                raise PostgresWorkspaceError("postgres_selection_unavailable", "A selected table or column is unavailable. Reload the table list and check permissions.", 422)
            if len(columns) > MAX_COLUMNS:
                raise _over_budget()
            snapshot = _snapshot(connection, table, columns, min(remaining_rows, remaining_cells // len(columns)), remaining_bytes)
            snapshots.append(snapshot)
            count = len(snapshot["dataframe"])
            remaining_rows -= count
            remaining_cells -= count * len(columns)
            remaining_bytes -= len(snapshot["file_bytes"])
    registered = register_managed_postgres_workspace(name=name, snapshots=snapshots)
    return _activate(registered, snapshots[0]["dataframe"], snapshots[0]["readiness"])


def open_workspace(workspace_id):
    workspace = get_workspace(workspace_id)
    source = get_source(workspace["primary_source_id"]) if workspace else None
    if source is None or workspace["workspace_kind"] != "postgres":
        raise PostgresWorkspaceError("postgres_workspace_not_found", "Saved PostgreSQL workspace was not found.", 404)
    try:
        bundle = load_datahub_dataset(source["source_id"])
    except (OSError, ValueError) as exc:
        raise PostgresWorkspaceError("postgres_snapshot_unavailable", "The saved primary snapshot could not be loaded.", 409) from exc
    frame = bundle["dataframe"]
    readiness = evaluate_dataset_readiness(frame, bundle["governance_policy"], operation="postgres_snapshot_open")
    if is_blocked(readiness):
        raise PostgresWorkspaceError("postgres_snapshot_blocked", "Dataset readiness blocked the saved primary snapshot.", 422, readiness)
    sources = [get_source(member["source_id"]) for member in workspace["sources"]]
    return _activate({"workspace": workspace, "source": source, "sources": sources,
                      "analysis_context": build_analysis_context(workspace, [source["source_id"]])}, frame, readiness)


def _activate(envelope, frame, readiness):
    model = envelope["source"]["semantic_model"]
    set_uploaded_df(frame)
    set_governance_state(readiness["policy"], readiness)
    set_semantic_model(model)
    return {**envelope, "data_preview": safe_json_records(frame.head()), "full_data": safe_json_records(frame),
            "semantic_model": model, "governance_readiness": readiness}
