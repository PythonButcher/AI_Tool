"""Managed local file storage for Document Studio.

Accepts raw bytes, computes a lowercase SHA-256 content hash, writes
beneath a configured storage root, and returns a storage key that cannot
escape that root.  Saving identical bytes is idempotent.  The caller
never supplies or controls a destination path.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from document_studio.application.ports import FileStore


class LocalFileStore(FileStore):
    """Concrete file store backed by the local filesystem.

    Files are stored in a hash-based directory fan-out under
    *storage_root*::

        <root>/<hash[0:2]>/<hash[2:4]>/<full_hash>

    Parameters
    ----------
    storage_root:
        Absolute or relative path to the directory that will contain all
        managed files.  Created automatically if it does not exist.
    """

    def __init__(self, storage_root: str | Path) -> None:
        self._root = Path(storage_root).resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    # -- internal helpers --------------------------------------------------

    @staticmethod
    def _content_hash(data: bytes) -> str:
        """Return the lowercase hex SHA-256 digest of *data*."""
        return hashlib.sha256(data).hexdigest().lower()

    @staticmethod
    def _key_from_hash(content_hash: str) -> str:
        """Derive the storage key from a content hash.

        Uses the first two and next two hex characters as nested
        directory prefixes for filesystem fan-out.
        """
        return f"{content_hash[:2]}/{content_hash[2:4]}/{content_hash}"

    def _resolve_and_guard(self, storage_key: str) -> Path:
        """Resolve *storage_key* to an absolute path under the storage
        root, raising ``ValueError`` if the resolved path would escape.
        """
        target = (self._root / storage_key).resolve()
        # Path-containment check: resolved target must start with root.
        try:
            target.relative_to(self._root)
        except ValueError:
            raise ValueError(
                f"Storage key would escape the storage root: {storage_key}"
            ) from None
        return target

    # -- public API --------------------------------------------------------

    def save(self, data: bytes) -> tuple[str, str]:
        """Store *data* and return ``(storage_key, content_hash)``.

        Idempotent: identical bytes are never written twice.
        """
        content_hash = self._content_hash(data)
        storage_key = self._key_from_hash(content_hash)
        target = self._resolve_and_guard(storage_key)

        if target.exists():
            return storage_key, content_hash

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return storage_key, content_hash

    def read(self, storage_key: str) -> bytes:
        """Return the bytes stored at *storage_key*.

        Raises ``FileNotFoundError`` if the key does not exist.
        """
        target = self._resolve_and_guard(storage_key)
        if not target.exists():
            raise FileNotFoundError(
                f"No file at storage key: {storage_key}"
            )
        return target.read_bytes()

    def exists(self, storage_key: str) -> bool:
        """Return ``True`` if *storage_key* refers to an existing file."""
        target = self._resolve_and_guard(storage_key)
        return target.exists()
