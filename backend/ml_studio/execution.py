"""Bounded background scheduling for durable ML Studio runs."""

from __future__ import annotations

import threading
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor, wait


class AsyncRunExecutor:
    """Schedule each run identity at most once per process."""

    def __init__(self, worker: Callable[[str], None], *, max_workers: int = 2) -> None:
        if not isinstance(max_workers, int) or max_workers < 1 or max_workers > 16:
            raise ValueError("max_workers must be between 1 and 16")
        self._worker = worker
        self._pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="ml-studio-run")
        self._lock = threading.RLock()
        self._futures: dict[str, Future[None]] = {}
        self._closed = False

    def schedule(self, run_id: str) -> bool:
        """Return False when this process is already executing the run."""
        with self._lock:
            if self._closed:
                raise RuntimeError("run executor is closed")
            existing = self._futures.get(run_id)
            if existing is not None and not existing.done():
                return False
            self._futures[run_id] = self._pool.submit(self._worker, run_id)
            return True

    def wait_for_idle(self, *, timeout: float | None = None) -> bool:
        """Wait for work visible at call time; intended for graceful shutdown and tests."""
        with self._lock:
            pending = tuple(future for future in self._futures.values() if not future.done())
        if not pending:
            return True
        _, unfinished = wait(pending, timeout=timeout)
        return not unfinished

    def shutdown(self, *, wait_for_runs: bool = True) -> None:
        with self._lock:
            self._closed = True
        self._pool.shutdown(wait=wait_for_runs, cancel_futures=not wait_for_runs)

