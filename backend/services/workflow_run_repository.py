"""Durable workflow run repository.

Persists workflow runs and their event history to JSON files so that
run state survives process restarts and remains inspectable after
navigation.  This replaces the in-memory ``_RUNS`` dict from the
original ``workflow_executor.py``.

Design decisions
----------------
* Each run is stored as ``backend/storage/workflow_runs/<run_id>.json``.
* Writes are atomic: write to a temp file then rename.
* Reads use a simple file lock (``threading.Lock``) to avoid torn reads
  from concurrent polling while the executor thread is writing.
* Terminal states (``completed``, ``failed``, ``cancelled``,
  ``interrupted``) are never overwritten by a non-terminal update.
  This prevents a concurrent status poll or late write from reverting
  a terminal outcome.
* Run payloads do NOT contain full input datasets, secrets, credentials,
  hidden prompts, or unbounded model output.  Results are truncated to
  a bounded summary.  Metadata, node status, timestamps, bounded event
  details, and bounded result summaries are persisted.
"""

import copy
import hashlib
import json
import logging
import os
import re
import threading
import tempfile
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple


logger = logging.getLogger(__name__)

RUN_STORAGE_DIR = (
    Path(__file__).resolve().parent.parent / "storage" / "workflow_runs"
)

# Maximum characters kept per result summary field.
MAX_RESULT_SUMMARY_CHARS = 4000

# Maximum serialized characters kept for one node result.
MAX_RESULT_SUMMARY_BYTES = 16000

# Maximum characters kept in one persisted event message.
MAX_EVENT_MESSAGE_CHARS = 1000

# Maximum number of events kept per run.
MAX_EVENTS_PER_RUN = 500

# Terminal states that must not be overwritten.
TERMINAL_STATES = frozenset({"completed", "failed", "cancelled", "interrupted"})

# All valid run states.
VALID_RUN_STATES = frozenset({
    "queued", "running", "cancel_requested",
    "cancelled", "completed", "failed", "interrupted",
})

_ALLOWED_TRANSITIONS = {
    "queued": frozenset({"running", "cancelled", "interrupted"}),
    "running": frozenset({"cancel_requested", "completed", "failed", "interrupted"}),
    "cancel_requested": frozenset({"cancelled", "interrupted"}),
    "cancelled": frozenset(),
    "completed": frozenset(),
    "failed": frozenset(),
    "interrupted": frozenset(),
}

_DATASET_KEYS = frozenset({
    "cleaned_data",
    "data",
    "rows",
    "records",
    "full_data",
    "raw_data",
    "dataset",
    "uploaded_data",
})

_SENSITIVE_KEY_PARTS = (
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "credential",
    "hidden_prompt",
    "password",
    "prompt",
    "secret",
    "system_prompt",
    "token",
)

# RLock lets atomic repository operations reuse the same locked helpers.
_WRITE_LOCK = threading.RLock()
# In-memory cache for fast reads during execution; flushed to disk on
# every write.  Keyed by run_id.
_CACHE: Dict[str, Dict[str, Any]] = {}

# Raw node outputs are never durable. A small process-local overlay preserves
# existing live-run behavior (for example applying cleaned rows) without
# writing datasets, prompts, or unbounded model output to history.
MAX_LIVE_RESULT_RUNS = 10
_LIVE_RESULTS: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()


class RunStateConflictError(RuntimeError):
    """Raised when a stale or invalid run-state transition is attempted."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_dir() -> None:
    RUN_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def _run_path(run_id: str) -> Path:
    return RUN_STORAGE_DIR / f"{run_id}.json"


def _idempotency_hash(idempotency_key: str) -> str:
    """Hash client keys so durable history never stores the raw token."""
    return hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()


def _truncate_value(value: Any, max_chars: int = MAX_RESULT_SUMMARY_CHARS) -> Any:
    """Truncate string values to bounded length for safe persistence.

    Non-string values are returned unchanged (dicts/lists are handled
    at the serialisation boundary).
    """
    if isinstance(value, str) and len(value) > max_chars:
        return value[:max_chars] + "… [truncated]"
    return value


def _sanitize_text(value: Any, max_chars: int) -> str:
    """Redact common credential forms before persisting diagnostic text."""
    text = str(value or "")
    text = re.sub(
        r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+",
        "Bearer [redacted]",
        text,
    )
    text = re.sub(
        r"(?i)\b(api[_-]?key|authorization|credential|password|secret|token)"
        r"\s*[:=]\s*[^\s,;]+",
        r"\1=[redacted]",
        text,
    )
    return _truncate_value(text, max_chars)


def _sanitize_result_value(value: Any, *, depth: int = 0) -> Any:
    """Recursively sanitize a result while keeping a small useful preview."""
    if depth >= 6:
        return "[omitted: nesting limit]"

    if isinstance(value, str):
        return _sanitize_text(value, MAX_RESULT_SUMMARY_CHARS)

    if isinstance(value, dict):
        safe: Dict[str, Any] = {}
        for index, (key, child) in enumerate(value.items()):
            if index >= 50:
                safe["_truncated_fields"] = len(value) - 50
                break

            key_text = str(key)
            normalized_key = key_text.casefold()
            if normalized_key in _DATASET_KEYS:
                if isinstance(child, list):
                    safe[key_text] = f"[{len(child)} items]"
                elif (
                    isinstance(child, str)
                    and re.fullmatch(r"\[(?:\d+ items|omitted)\]", child)
                ):
                    # Keep serialization idempotent across later state writes.
                    safe[key_text] = child
                else:
                    safe[key_text] = "[omitted]"
                continue
            if any(part in normalized_key for part in _SENSITIVE_KEY_PARTS):
                safe[key_text] = "[redacted]"
                continue
            safe[key_text] = _sanitize_result_value(child, depth=depth + 1)
        return safe

    if isinstance(value, (list, tuple)):
        preview = [
            _sanitize_result_value(item, depth=depth + 1)
            for item in list(value)[:20]
        ]
        if len(value) > 20:
            preview.append(f"[{len(value) - 20} more items omitted]")
        return preview

    if isinstance(value, (int, float, bool)) or value is None:
        return value

    return _truncate_value(str(value))


def _truncate_result(result: Any) -> Any:
    """Produce a bounded summary of a node result for persistence.

    Full datasets, raw uploaded rows, and unbounded model output are
    stripped.  Safe metadata and bounded summaries are kept.
    """
    safe = _sanitize_result_value(result)
    serialized = json.dumps(safe, default=str, ensure_ascii=False)
    if len(serialized) <= MAX_RESULT_SUMMARY_BYTES:
        return safe
    return {
        "summary": "[result omitted: exceeded persistence limit]",
        "truncated": True,
    }


def _truncate_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Keep a bounded, sanitized tail of the event stream."""
    bounded = events[-MAX_EVENTS_PER_RUN:]
    safe_events: List[Dict[str, Any]] = []
    for event in bounded:
        if not isinstance(event, dict):
            continue
        safe_events.append({
            "timestamp": event.get("timestamp"),
            "type": _sanitize_text(event.get("type"), 100),
            "node_id": _truncate_value(str(event.get("node_id")), 200)
            if event.get("node_id") is not None
            else None,
            "message": _sanitize_text(
                event.get("message"),
                MAX_EVENT_MESSAGE_CHARS,
            ),
        })
    return safe_events


def _serialise_run(run_state: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare a run state dict for durable persistence.

    Truncates results and events to bounded sizes.  Never persists
    full input datasets.
    """
    safe = copy.deepcopy(run_state)

    # Truncate per-node results
    results = safe.get("results") or {}
    for node_id, entry in results.items():
        if isinstance(entry, dict) and "result" in entry:
            entry["result"] = _truncate_result(entry["result"])
        if isinstance(entry, dict) and entry.get("error") is not None:
            entry["error"] = _sanitize_text(
                entry["error"],
                MAX_EVENT_MESSAGE_CHARS,
            )

    node_states = safe.get("node_states") or {}
    for entry in node_states.values():
        if isinstance(entry, dict) and entry.get("error") is not None:
            entry["error"] = _sanitize_text(
                entry["error"],
                MAX_EVENT_MESSAGE_CHARS,
            )

    # Truncate events
    safe["events"] = _truncate_events(safe.get("events") or [])

    # Never persist full datasets
    safe.pop("_dataset", None)
    safe.pop("dataset", None)
    raw_idempotency_key = safe.pop("idempotency_key", None)
    if raw_idempotency_key and not safe.get("idempotency_key_hash"):
        safe["idempotency_key_hash"] = _idempotency_hash(str(raw_idempotency_key))

    return safe


def _write_run_atomic(run_id: str, data: Dict[str, Any]) -> None:
    """Write run state to disk atomically."""
    _ensure_dir()
    target = _run_path(run_id)
    # Write to a temp file in the same directory then rename for atomicity
    fd, tmp_path = tempfile.mkstemp(
        dir=str(RUN_STORAGE_DIR), suffix=".tmp", prefix=f"{run_id}-"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        # os.replace atomically swaps the target on both Windows and POSIX.
        os.replace(tmp_path, str(target))
    except Exception:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def _load_run_locked(run_id: str) -> Optional[Dict[str, Any]]:
    cached = _CACHE.get(run_id)
    if cached:
        return copy.deepcopy(cached)

    path = _run_path(run_id)
    if not path.exists():
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to read run %s from disk: %s", run_id, exc)
        return None

    _CACHE[run_id] = copy.deepcopy(data)
    return copy.deepcopy(data)


def _merge_live_results_locked(run_state: Dict[str, Any]) -> Dict[str, Any]:
    merged = copy.deepcopy(run_state)
    live_results = _LIVE_RESULTS.get(run_state.get("run_id"))
    if not live_results:
        return merged

    persisted_results = merged.setdefault("results", {})
    for node_id, result in live_results.items():
        entry = persisted_results.get(node_id)
        if isinstance(entry, dict):
            entry["result"] = copy.deepcopy(result)
    return merged


def store_live_result(run_id: str, node_id: str, result: Any) -> None:
    """Keep a bounded non-durable result overlay for the active process."""
    with _WRITE_LOCK:
        run_results = _LIVE_RESULTS.setdefault(run_id, {})
        run_results[node_id] = copy.deepcopy(result)
        _LIVE_RESULTS.move_to_end(run_id)
        while len(_LIVE_RESULTS) > MAX_LIVE_RESULT_RUNS:
            _LIVE_RESULTS.popitem(last=False)


def _validate_transition(existing_status: str, new_status: str) -> None:
    if new_status not in VALID_RUN_STATES:
        raise RunStateConflictError(f"Unknown workflow run state: {new_status!r}.")
    if existing_status == new_status:
        return
    if new_status not in _ALLOWED_TRANSITIONS.get(existing_status, frozenset()):
        raise RunStateConflictError(
            f"Invalid workflow run transition: {existing_status!r} -> "
            f"{new_status!r}."
        )


def _persist_locked(run_state: Dict[str, Any], *, revision: int) -> Dict[str, Any]:
    candidate = copy.deepcopy(run_state)
    candidate["revision"] = revision
    serialised = _serialise_run(candidate)
    _write_run_atomic(candidate["run_id"], serialised)
    _CACHE[candidate["run_id"]] = copy.deepcopy(serialised)
    return copy.deepcopy(serialised)


def store_run(run_state: Dict[str, Any]) -> Dict[str, Any]:
    """Persist a run state to disk and cache.

    If the run is already in a terminal state on disk, this function
    refuses to overwrite it with a non-terminal state.  This prevents
    a late background-thread write from reverting a cancellation or
    completion.

    Returns a deep copy of the stored state.
    """
    run_id = run_state["run_id"]
    new_status = run_state.get("status", "")

    with _WRITE_LOCK:
        existing = _load_run_locked(run_id)
        if not existing:
            if new_status not in VALID_RUN_STATES:
                raise RunStateConflictError(
                    f"Unknown workflow run state: {new_status!r}."
                )
            return _persist_locked(run_state, revision=1)

        if existing.get("status") in TERMINAL_STATES:
            return existing

        expected_revision = run_state.get("revision")
        if expected_revision != existing.get("revision"):
            raise RunStateConflictError(
                f"Stale workflow run update for {run_id}: expected revision "
                f"{existing.get('revision')}, received {expected_revision}."
            )

        _validate_transition(existing.get("status", ""), new_status)
        return _persist_locked(
            run_state,
            revision=int(existing.get("revision") or 0) + 1,
        )


def update_run(
    run_id: str,
    mutator: Callable[[Dict[str, Any]], Optional[Dict[str, Any]]],
) -> Optional[Dict[str, Any]]:
    """Atomically read, mutate, validate, and persist a run.

    Runtime state changes must use this boundary instead of a separate
    ``get_run``/``store_run`` pair. This prevents cancellation or a terminal
    result from being lost between two concurrent requests.
    """
    with _WRITE_LOCK:
        existing = _load_run_locked(run_id)
        if not existing:
            return None
        if existing.get("status") in TERMINAL_STATES:
            return existing

        candidate = copy.deepcopy(existing)
        mutated = mutator(candidate)
        if mutated is not None:
            candidate = mutated
        if candidate == existing:
            return existing

        _validate_transition(
            existing.get("status", ""),
            candidate.get("status", ""),
        )
        return _persist_locked(
            candidate,
            revision=int(existing.get("revision") or 0) + 1,
        )


def get_run(
    run_id: str,
    *,
    include_live_results: bool = True,
) -> Optional[Dict[str, Any]]:
    """Retrieve a run state by ID.

    Checks the in-memory cache first, then falls back to disk.
    Returns None if the run does not exist.
    """
    with _WRITE_LOCK:
        run_state = _load_run_locked(run_id)
        if not run_state:
            return None
        if include_live_results:
            return _merge_live_results_locked(run_state)
        return run_state


def list_runs(
    *,
    workflow_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """List runs with optional filtering and pagination.

    Returns a dict with ``runs`` (list of run summaries), ``total``
    (total matching count), ``limit``, and ``offset``.
    """
    with _WRITE_LOCK:
        _ensure_dir()
        run_files = sorted(
            RUN_STORAGE_DIR.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

        summaries: List[Dict[str, Any]] = []
        for path in run_files:
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue

            if workflow_id and data.get("workflow_id") != workflow_id:
                continue

            summaries.append({
                "run_id": data.get("run_id"),
                "workflow_id": data.get("workflow_id"),
                "workflow_name": data.get("workflow_name"),
                "status": data.get("status"),
                "started_at": data.get("started_at"),
                "finished_at": data.get("finished_at"),
                "progress": data.get("progress"),
                "dataset_rows": data.get("dataset_rows"),
                "created_at": data.get("created_at"),
            })

    total = len(summaries)
    # Clamp offset and limit
    safe_offset = max(0, min(offset, total))
    safe_limit = max(1, min(limit, 100))
    page = summaries[safe_offset : safe_offset + safe_limit]

    return {
        "runs": page,
        "total": total,
        "limit": safe_limit,
        "offset": safe_offset,
    }


def get_run_events(
    run_id: str,
    *,
    limit: int = 100,
    offset: int = 0,
) -> Optional[Dict[str, Any]]:
    """Return paginated events for a specific run."""
    run = get_run(run_id, include_live_results=False)
    if not run:
        return None

    events = run.get("events") or []
    total = len(events)
    safe_offset = max(0, min(offset, total))
    safe_limit = max(1, min(limit, 200))
    page = events[safe_offset : safe_offset + safe_limit]

    return {
        "run_id": run_id,
        "events": page,
        "total": total,
        "limit": safe_limit,
        "offset": safe_offset,
    }


def check_idempotency_key(idempotency_key: str) -> Optional[Dict[str, Any]]:
    """Check if a run with the given idempotency key already exists.

    Scans the cache and disk for a matching key.  Returns the existing
    run state if found, None otherwise.
    """
    if not idempotency_key:
        return None
    key_hash = _idempotency_hash(str(idempotency_key))

    with _WRITE_LOCK:
        for run_state in _CACHE.values():
            if (
                run_state.get("idempotency_key_hash") == key_hash
                or run_state.get("idempotency_key") == idempotency_key
            ):
                return _merge_live_results_locked(run_state)

        _ensure_dir()
        for path in RUN_STORAGE_DIR.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if (
                    data.get("idempotency_key_hash") == key_hash
                    or data.get("idempotency_key") == idempotency_key
                ):
                    _CACHE[data["run_id"]] = data
                    return _merge_live_results_locked(data)
            except (json.JSONDecodeError, OSError):
                continue

    return None


def create_run_if_absent(
    run_state: Dict[str, Any],
    *,
    idempotency_key: Optional[str] = None,
) -> Tuple[Dict[str, Any], bool]:
    """Atomically create a queued run unless its idempotency key exists."""
    if idempotency_key is not None:
        if not isinstance(idempotency_key, str):
            raise ValueError("Idempotency key must be a string.")
        idempotency_key = idempotency_key.strip()
        if not idempotency_key:
            raise ValueError("Idempotency key cannot be blank.")
        if len(idempotency_key) > 256:
            raise ValueError("Idempotency key cannot exceed 256 characters.")

    with _WRITE_LOCK:
        if idempotency_key:
            existing = check_idempotency_key(idempotency_key)
            if existing:
                return existing, False

        candidate = copy.deepcopy(run_state)
        if idempotency_key:
            candidate["idempotency_key_hash"] = _idempotency_hash(
                idempotency_key
            )
        candidate.pop("idempotency_key", None)
        stored = store_run(candidate)
        return stored, True


def request_cancellation(run_id: str) -> Optional[Dict[str, Any]]:
    """Request cooperative cancellation of a run.

    Sets the run status to ``cancel_requested`` if it is currently
    ``queued`` or ``running``.  The executor thread checks this flag
    before starting each node.

    If the run is already in a terminal state, returns the current
    state unchanged.  If the run is ``queued`` (not yet started),
    transitions directly to ``cancelled``.
    """
    def apply_cancellation(run: Dict[str, Any]) -> Dict[str, Any]:
        current_status = run.get("status", "")
        if current_status == "cancel_requested":
            return run
        if current_status == "queued":
            run["status"] = "cancelled"
            run["finished_at"] = _utc_now()
            message = "Workflow cancelled before execution started."
            event_type = "cancelled"
        else:
            run["status"] = "cancel_requested"
            message = "Cancellation requested. Will stop before the next node."
            event_type = "cancel_requested"
        run.setdefault("events", []).append({
            "timestamp": _utc_now(),
            "type": event_type,
            "node_id": None,
            "message": message,
        })
        return run

    return update_run(run_id, apply_cancellation)


def mark_interrupted(run_id: str, reason: str) -> Optional[Dict[str, Any]]:
    """Mark a run as interrupted.

    Used when a restart or unrecoverable error means the run cannot
    be safely resumed.  The ``reason`` is recorded in the events.
    """
    def apply_interruption(run: Dict[str, Any]) -> Dict[str, Any]:
        run["status"] = "interrupted"
        run["finished_at"] = _utc_now()
        run.setdefault("events", []).append({
            "timestamp": _utc_now(),
            "type": "interrupted",
            "node_id": None,
            "message": f"Run interrupted: {reason}",
        })
        return run

    return update_run(run_id, apply_interruption)


def recover_incomplete_runs() -> List[str]:
    """On startup, mark any non-terminal runs as interrupted.

    Returns the list of run IDs that were marked interrupted.
    A restart must not pretend an unfinished run completed.
    """
    _ensure_dir()
    interrupted_ids: List[str] = []

    for path in RUN_STORAGE_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        status = data.get("status", "")
        if status and status not in TERMINAL_STATES:
            run_id = data.get("run_id", path.stem)
            mark_interrupted(
                run_id,
                "Process restarted while run was in progress. "
                "Cannot safely resume execution.",
            )
            interrupted_ids.append(run_id)

    return interrupted_ids
