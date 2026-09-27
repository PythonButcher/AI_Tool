"""Integrity-checked, server-owned artifact storage for ML Studio.

The store deliberately exposes metadata rather than filesystem paths or bytes.
Artifacts are write-once, created through an atomic replace while a process-safe
lock file is held, and confined to a single managed root.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
import threading
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Final


_IDENTIFIER: Final = re.compile(r"^[A-Za-z][A-Za-z0-9_.:-]{0,127}$")
_ARTIFACT_NAME: Final = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_MEDIA_TYPE: Final = re.compile(r"^[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$")
MAX_ARTIFACT_BYTES: Final = 512 * 1024 * 1024


class ArtifactStoreError(ValueError):
    """A stable, safely reportable artifact boundary failure."""

    def __init__(self, code: str, message: str, remediation: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.remediation = remediation

    def to_dict(self) -> dict[str, str]:
        return {
            "code": self.code,
            "message": self.message,
            "remediation": self.remediation,
        }


@dataclass(frozen=True, slots=True)
class ArtifactMetadata:
    run_id: str
    name: str
    sha256: str
    size_bytes: int
    media_type: str
    created_at: str

    def __post_init__(self) -> None:
        if not _IDENTIFIER.fullmatch(self.run_id):
            raise ValueError("run_id is invalid")
        if not _ARTIFACT_NAME.fullmatch(self.name) or self.name in {".", ".."}:
            raise ValueError("artifact name is invalid")
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", self.sha256):
            raise ValueError("sha256 is invalid")
        if not isinstance(self.size_bytes, int) or isinstance(self.size_bytes, bool) or self.size_bytes < 0:
            raise ValueError("size_bytes must be a non-negative integer")
        if not _MEDIA_TYPE.fullmatch(self.media_type):
            raise ValueError("media_type is invalid")
        parsed = datetime.fromisoformat(self.created_at)
        if parsed.tzinfo is None:
            raise ValueError("created_at must include a timezone")

    def to_dict(self) -> dict[str, str | int]:
        return asdict(self)


class ManagedArtifactStore:
    """Write and verify immutable artifacts beneath one private root."""

    def __init__(self, root: str | os.PathLike[str], *, max_bytes: int = MAX_ARTIFACT_BYTES) -> None:
        if not isinstance(max_bytes, int) or isinstance(max_bytes, bool) or max_bytes < 1:
            raise ValueError("max_bytes must be a positive integer")
        configured_root = Path(root).absolute()
        if configured_root.exists() and configured_root.is_symlink():
            raise ArtifactStoreError(
                "artifact_root_invalid",
                "The managed artifact root is not a safe directory.",
                "Configure a server-owned directory that is not a symbolic link.",
            )
        self._root = configured_root.resolve(strict=False)
        self._max_bytes = max_bytes
        self._lock = threading.RLock()
        self._root.mkdir(parents=True, exist_ok=True)
        if self._root.is_symlink() or not self._root.is_dir():
            raise ArtifactStoreError(
                "artifact_root_invalid",
                "The managed artifact root is not a safe directory.",
                "Configure a server-owned directory that is not a symbolic link.",
            )

    @staticmethod
    def _validate_run_id(run_id: str) -> None:
        if not isinstance(run_id, str) or not _IDENTIFIER.fullmatch(run_id):
            raise ArtifactStoreError(
                "artifact_run_id_invalid",
                "The artifact run identity is invalid.",
                "Use the server-issued run identity.",
            )

    @staticmethod
    def _validate_name(name: str) -> None:
        if (
            not isinstance(name, str)
            or not _ARTIFACT_NAME.fullmatch(name)
            or name in {".", ".."}
            or Path(name).is_absolute()
            or "/" in name
            or "\\" in name
        ):
            raise ArtifactStoreError(
                "artifact_name_invalid",
                "The artifact name is invalid.",
                "Use a bounded server-generated file name without path separators.",
            )

    def _safe_run_directory(self, run_id: str, *, create: bool) -> Path:
        self._validate_run_id(run_id)
        run_directory = self._root / run_id
        if create:
            run_directory.mkdir(mode=0o700, parents=False, exist_ok=True)
        if run_directory.exists() and (run_directory.is_symlink() or not run_directory.is_dir()):
            raise ArtifactStoreError(
                "artifact_path_unsafe",
                "The managed artifact location is unsafe.",
                "Remove the invalid managed entry and retry with a server-issued run identity.",
            )
        resolved = run_directory.resolve(strict=False)
        if resolved.parent != self._root:
            raise ArtifactStoreError(
                "artifact_path_unsafe",
                "The managed artifact location escapes its configured root.",
                "Use only server-generated artifact identities.",
            )
        return resolved

    def write(
        self,
        run_id: str,
        name: str,
        content: bytes,
        *,
        media_type: str,
        server_created: bool,
    ) -> ArtifactMetadata:
        """Atomically create one artifact; existing artifacts are never overwritten."""
        self._validate_name(name)
        if server_created is not True:
            raise ArtifactStoreError(
                "artifact_origin_untrusted",
                "Only server-created artifacts may enter managed storage.",
                "Create the artifact from a trusted server-side pipeline.",
            )
        if not isinstance(content, bytes):
            raise ArtifactStoreError(
                "artifact_content_invalid",
                "Artifact content must be an in-memory byte sequence.",
                "Serialize the trusted server-created result before storage.",
            )
        if len(content) > self._max_bytes:
            raise ArtifactStoreError(
                "artifact_too_large",
                "The artifact exceeds the configured storage limit.",
                "Reduce the artifact size or raise the explicit server limit.",
            )
        normalized_media_type = str(media_type).strip().lower()
        if not _MEDIA_TYPE.fullmatch(normalized_media_type):
            raise ArtifactStoreError(
                "artifact_media_type_invalid",
                "The artifact media type is invalid.",
                "Use a specific lowercase media type for the server-created artifact.",
            )

        with self._lock:
            run_directory = self._safe_run_directory(run_id, create=True)
            destination = run_directory / name
            metadata_path = run_directory / f"{name}.metadata.json"
            lock_path = run_directory / f".{name}.lock"
            if destination.exists() or metadata_path.exists():
                raise ArtifactStoreError(
                    "artifact_immutable",
                    "The managed artifact already exists and cannot be overwritten.",
                    "Use a new server-generated artifact name or run identity.",
                )

            try:
                lock_fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            except FileExistsError as exc:
                raise ArtifactStoreError(
                    "artifact_write_conflict",
                    "Another writer is creating this artifact.",
                    "Retry with the same immutable artifact identity.",
                ) from exc

            content_temp: Path | None = None
            metadata_temp: Path | None = None
            content_committed = False
            try:
                os.close(lock_fd)
                digest = hashlib.sha256(content).hexdigest()
                created_at = datetime.now(UTC).isoformat()
                metadata = ArtifactMetadata(
                    run_id=run_id,
                    name=name,
                    sha256=f"sha256:{digest}",
                    size_bytes=len(content),
                    media_type=normalized_media_type,
                    created_at=created_at,
                )
                with tempfile.NamedTemporaryFile(dir=run_directory, prefix=f".{name}.", delete=False) as handle:
                    handle.write(content)
                    handle.flush()
                    os.fsync(handle.fileno())
                    content_temp = Path(handle.name)
                with tempfile.NamedTemporaryFile(
                    mode="w", encoding="utf-8", dir=run_directory, prefix=f".{name}.metadata.", delete=False
                ) as handle:
                    json.dump(metadata.to_dict(), handle, allow_nan=False, sort_keys=True, separators=(",", ":"))
                    handle.flush()
                    os.fsync(handle.fileno())
                    metadata_temp = Path(handle.name)
                if destination.exists() or metadata_path.exists():
                    raise ArtifactStoreError(
                        "artifact_immutable",
                        "The managed artifact already exists and cannot be overwritten.",
                        "Use a new server-generated artifact name or run identity.",
                    )
                os.replace(content_temp, destination)
                content_temp = None
                content_committed = True
                os.replace(metadata_temp, metadata_path)
                metadata_temp = None
                return metadata
            finally:
                for temporary in (content_temp, metadata_temp):
                    if temporary is not None:
                        temporary.unlink(missing_ok=True)
                if content_committed and not metadata_path.exists():
                    destination.unlink(missing_ok=True)
                lock_path.unlink(missing_ok=True)

    def verify(self, run_id: str, name: str) -> ArtifactMetadata:
        """Verify stored bytes against immutable sidecar metadata."""
        self._validate_name(name)
        with self._lock:
            run_directory = self._safe_run_directory(run_id, create=False)
            destination = run_directory / name
            metadata_path = run_directory / f"{name}.metadata.json"
            if destination.is_symlink() or metadata_path.is_symlink():
                raise ArtifactStoreError(
                    "artifact_path_unsafe",
                    "The managed artifact location is unsafe.",
                    "Quarantine the managed run directory and recreate the artifact.",
                )
            try:
                raw = json.loads(metadata_path.read_text(encoding="utf-8"))
                metadata = ArtifactMetadata(**raw)
                content = destination.read_bytes()
            except (FileNotFoundError, OSError, TypeError, ValueError, json.JSONDecodeError) as exc:
                raise ArtifactStoreError(
                    "artifact_missing_or_invalid",
                    "The managed artifact or its metadata is unavailable.",
                    "Recreate the artifact from the immutable run inputs.",
                ) from exc
            digest = f"sha256:{hashlib.sha256(content).hexdigest()}"
            if (
                metadata.run_id != run_id
                or metadata.name != name
                or metadata.size_bytes != len(content)
                or metadata.sha256 != digest
            ):
                raise ArtifactStoreError(
                    "artifact_integrity_failed",
                    "The managed artifact failed its integrity check.",
                    "Quarantine it and recreate it from the immutable run inputs.",
                )
            return metadata

    def delete_run(self, run_id: str) -> int:
        """Delete files for one validated run without following links."""
        with self._lock:
            run_directory = self._safe_run_directory(run_id, create=False)
            if not run_directory.exists():
                return 0
            entries = list(run_directory.iterdir())
            if any(entry.is_symlink() or not entry.is_file() for entry in entries):
                raise ArtifactStoreError(
                    "artifact_cleanup_unsafe",
                    "Managed artifact cleanup found an unsafe entry.",
                    "Inspect the managed run directory before retrying cleanup.",
                )
            for entry in entries:
                entry.unlink()
            run_directory.rmdir()
            return len(entries)
