"""Application-layer ports for Document Studio.

These abstract interfaces define the boundaries between the application
layer and infrastructure adapters.  They may import domain objects but
must not import SQLite, filesystem implementations, FastAPI, Flask, or
AI_Tool state.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from document_studio.domain.records import (
    Document,
    DocumentBlueprint,
    DocumentVersion,
    ProcessingRun,
    ProcessingStatus,
    ExtractedField,
    BlueprintFieldDefinition,
)


class FileStore(ABC):
    """Interface for managed file storage.

    Implementations accept raw bytes, compute a content hash, and store
    the data under a managed key.  The caller never supplies or controls
    the destination path.
    """

    @abstractmethod
    def save(self, data: bytes) -> tuple[str, str]:
        """Store *data* and return ``(storage_key, content_hash)``.

        Saving identical bytes must be idempotent: the same key and hash
        are returned without re-writing the file.
        """

    @abstractmethod
    def read(self, storage_key: str) -> bytes:
        """Return the bytes stored at *storage_key*.

        Raises ``FileNotFoundError`` if the key does not exist.
        """

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        """Return ``True`` if *storage_key* exists in the store."""


class DocumentRepository(ABC):
    """Interface for document metadata persistence.

    Implementations persist documents, versions, processing runs, and
    blueprints.  Duplicate content registration returns the existing
    document.  Processing runs and blueprints are append-only; creation
    must not overwrite an existing identity.
    """

    # ----- Documents -----

    @abstractmethod
    def register_document(
        self,
        content_hash: str,
        original_filename: str,
        media_type: str,
    ) -> Document:
        """Register a document by content hash.

        If a document with the same *content_hash* already exists, return
        the existing document instead of creating a duplicate.
        """

    @abstractmethod
    def get_document(self, document_id: UUID) -> Document | None:
        """Return the document with *document_id*, or ``None``."""

    @abstractmethod
    def find_document_by_hash(self, content_hash: str) -> Document | None:
        """Return the document with *content_hash*, or ``None``."""

    # ----- Versions -----

    @abstractmethod
    def create_version(
        self,
        document_id: UUID,
        content_hash: str,
        storage_key: str,
        byte_size: int,
    ) -> DocumentVersion:
        """Create a new version for *document_id*.

        The version number is automatically assigned as the next
        sequential positive integer for that document.
        """

    @abstractmethod
    def get_versions(self, document_id: UUID) -> list[DocumentVersion]:
        """Return all versions for *document_id*, ordered by version number."""

    # ----- Processing Runs -----

    @abstractmethod
    def create_processing_run(
        self,
        version_id: UUID,
        blueprint_id: UUID | None,
        status: ProcessingStatus,
        extracted_fields: tuple[ExtractedField, ...] = (),
        *,
        run_id: UUID | None = None,
    ) -> ProcessingRun:
        """Create an append-only processing run record.

        If *run_id* is supplied it is used as the record identity;
        otherwise a new UUID is generated.  Raises ``ValueError`` if
        a run with that identity already exists.
        """

    @abstractmethod
    def get_processing_run(self, run_id: UUID) -> ProcessingRun | None:
        """Return the processing run with *run_id*, or ``None``."""

    # ----- Blueprints -----

    @abstractmethod
    def create_blueprint(
        self,
        name: str,
        version_number: int,
        field_definitions: tuple[BlueprintFieldDefinition, ...],
        *,
        blueprint_id: UUID | None = None,
    ) -> DocumentBlueprint:
        """Create an append-only blueprint record.

        If *blueprint_id* is supplied it is used as the record identity;
        otherwise a new UUID is generated.  Raises ``ValueError`` if
        a blueprint with that identity already exists.
        """

    @abstractmethod
    def get_blueprint(self, blueprint_id: UUID) -> DocumentBlueprint | None:
        """Return the blueprint with *blueprint_id*, or ``None``."""
