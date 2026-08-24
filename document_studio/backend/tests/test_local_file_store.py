"""Unit tests for the managed local file store.

Covers content hashing, path containment, idempotent writes, read-back
verification, and storage key format.  All tests use temporary
directories.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
import unittest
from pathlib import Path

from document_studio.infrastructure.local_file_store import LocalFileStore


class TestLocalFileStore(unittest.TestCase):
    """Tests for ``LocalFileStore``."""

    def setUp(self) -> None:
        self._tmpdir = tempfile.mkdtemp()
        self.store = LocalFileStore(self._tmpdir)

    def tearDown(self) -> None:
        import shutil

        shutil.rmtree(self._tmpdir, ignore_errors=True)

    # -- content hashing ---------------------------------------------------

    def test_hash_matches_known_sha256(self) -> None:
        """Verify the computed hash matches the stdlib SHA-256."""
        data = b"hello world"
        expected = hashlib.sha256(data).hexdigest().lower()
        key, content_hash = self.store.save(data)
        self.assertEqual(content_hash, expected)

    def test_hash_is_lowercase_hex(self) -> None:
        _, content_hash = self.store.save(b"test data")
        self.assertEqual(content_hash, content_hash.lower())
        self.assertTrue(all(c in "0123456789abcdef" for c in content_hash))

    # -- storage key format ------------------------------------------------

    def test_key_format_contains_hash(self) -> None:
        """Storage key must embed the full content hash."""
        data = b"format check"
        key, content_hash = self.store.save(data)
        self.assertIn(content_hash, key)

    def test_key_has_directory_fanout(self) -> None:
        """Storage key must use hash-based directory fan-out."""
        key, content_hash = self.store.save(b"fanout check")
        parts = key.split("/")
        self.assertEqual(len(parts), 3)
        self.assertEqual(parts[0], content_hash[:2])
        self.assertEqual(parts[1], content_hash[2:4])
        self.assertEqual(parts[2], content_hash)

    # -- path containment --------------------------------------------------

    def test_traversal_attempt_raises(self) -> None:
        """A storage key containing ``..`` must be rejected."""
        with self.assertRaises(ValueError):
            self.store.read("../../etc/passwd")

    def test_absolute_path_attempt_raises(self) -> None:
        """An absolute-looking key must be rejected if it escapes root."""
        # On Windows, /etc/passwd resolves outside the temp dir.
        with self.assertRaises((ValueError, FileNotFoundError)):
            self.store.read("/etc/passwd")

    # -- idempotent writes -------------------------------------------------

    def test_idempotent_same_key(self) -> None:
        """Saving the same bytes twice returns the same key."""
        data = b"duplicate content"
        key1, hash1 = self.store.save(data)
        key2, hash2 = self.store.save(data)
        self.assertEqual(key1, key2)
        self.assertEqual(hash1, hash2)

    def test_idempotent_single_file(self) -> None:
        """Idempotent save does not create a second file."""
        data = b"only once on disk"
        key, _ = self.store.save(data)
        target = Path(self._tmpdir) / key
        mtime_before = os.path.getmtime(target)

        # Save again — file should not be rewritten.
        self.store.save(data)
        mtime_after = os.path.getmtime(target)
        self.assertEqual(mtime_before, mtime_after)

    # -- read-back ---------------------------------------------------------

    def test_read_matches_original(self) -> None:
        """Data read back from the store must match what was saved."""
        data = b"round trip content \x00\xff"
        key, _ = self.store.save(data)
        self.assertEqual(self.store.read(key), data)

    def test_read_missing_key_raises(self) -> None:
        with self.assertRaises(FileNotFoundError):
            self.store.read("00/00/nonexistent")

    # -- exists ------------------------------------------------------------

    def test_exists_after_save(self) -> None:
        key, _ = self.store.save(b"exists check")
        self.assertTrue(self.store.exists(key))

    def test_not_exists_before_save(self) -> None:
        self.assertFalse(self.store.exists("aa/bb/missing"))

    # -- storage root creation ---------------------------------------------

    def test_creates_storage_root(self) -> None:
        """Storage root is created automatically if it does not exist."""
        new_root = Path(self._tmpdir) / "nested" / "root"
        store = LocalFileStore(new_root)
        self.assertTrue(new_root.exists())
        key, _ = store.save(b"nested root test")
        self.assertEqual(store.read(key), b"nested root test")


if __name__ == "__main__":
    unittest.main()
