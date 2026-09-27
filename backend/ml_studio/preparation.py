"""Draft preparation lifecycle with injected catalog execution and recovery."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from typing import Any
from uuid import uuid4

from .contracts import TransformationRecipeLineage, TransformationStep
from .repository import MLStudioRepository, PersistenceError
from .service import MLStudioService, MLStudioServiceError, _snapshot_from_dict, _stable_preparation_id


class DraftPreparationService:
    """Reserve a saved draft and recover independently durable cleaning commits.

    Scientific contracts and ML persistence never import the application's
    catalog or global data. Trusted route adapters supply those boundaries.
    """

    def __init__(self, service: MLStudioService, repository: MLStudioRepository,
                 cleaner: Callable[..., dict], receipt_lookup: Callable[[str, str], dict | None]):
        self.service = service
        self.repository = repository
        self.cleaner = cleaner
        self.receipt_lookup = receipt_lookup

    @staticmethod
    def _invalid(message: str) -> MLStudioServiceError:
        return MLStudioServiceError("preparation_request_invalid", message, "Use the documented preparation fields and server identities.")

    def _operation(self, operation_id: str, experiment_id: str, workspace_id: str) -> dict:
        self.service.get_draft(experiment_id, workspace_id)
        operation = self.repository.get_preparation(operation_id, experiment_id, workspace_id)
        if operation is None:
            raise MLStudioServiceError("preparation_not_found", "Preparation is unavailable in this draft.", "Reload the current draft preparation context.", status_code=404)
        return operation

    def options(self, experiment_id: str, workspace_id: str) -> dict:
        envelope = self.service.get_draft(experiment_id, workspace_id)
        draft = envelope["draft"]
        if not draft["snapshot_id"] or not draft["task_type"]:
            raise self._invalid("Save a data snapshot and task before preparing data.")
        snapshot = _snapshot_from_dict(self.service.get_snapshot(draft["snapshot_id"]))
        self.service._assert_snapshot_current(snapshot)
        issues, fixes = [], []
        for column in snapshot.column_profile:
            if column.null_count:
                issue_id = _stable_preparation_id("issue", "missing_values", column.name)
                fix_id = _stable_preparation_id("fix", "remove_nulls", column.name)
                issues.append({"issue_id": issue_id, "code": "missing_values", "severity": "warning",
                               "field": column.name, "message": "This field contains missing values.",
                               "remediation": "Choose a preparation strategy appropriate to this field."})
                fixes.append({"fix_id": fix_id, "issue_id": issue_id, "action_type": "remove_nulls",
                              "affected_columns": [column.name], "parameters": {"columns": [column.name]},
                              "support_status": "supported", "explanation": "Remove rows missing this field; this may reduce the sample."})
        return {"snapshot_id": snapshot.snapshot_id, "issues": issues, "fixes": fixes,
                "preparation_context": envelope["preparation_context"]}

    def begin(self, experiment_id: str, workspace_id: str, etag: str, key: str, payload: Any) -> dict:
        required = {"snapshot_id", "steps", "issue_id", "fix_id", "return_stage"}
        if not isinstance(payload, dict) or set(payload) != required:
            raise self._invalid("Supply snapshot_id, steps, issue_id, fix_id, and return_stage.")
        if not isinstance(key, str) or not key.strip() or len(key) > 256:
            raise self._invalid("A bounded Idempotency-Key is required.")
        if not isinstance(etag, str) or not etag:
            raise self._invalid("If-Match is required.")
        try:
            intent = json.dumps({"etag": etag, **payload}, sort_keys=True, allow_nan=False, separators=(",", ":"))
            if len(intent.encode()) > 64 * 1024:
                raise ValueError("intent too large")
            intent_hash = hashlib.sha256(intent.encode()).hexdigest()
        except (ValueError, TypeError) as exc:
            raise self._invalid("Preparation intent must be bounded finite JSON.") from exc
        self.service.get_draft(experiment_id, workspace_id)
        try:
            replay = self.repository.find_preparation_start(experiment_id, workspace_id, key, intent_hash)
            if replay:
                return {"preparation": replay}
            draft = self.service.get_draft(experiment_id, workspace_id)["draft"]
            if draft["etag"] != etag:
                raise MLStudioServiceError("draft_revision_conflict", "The draft revision changed.", "Reload the current ETag.", status_code=409)
            if not isinstance(payload["snapshot_id"], str) or payload["snapshot_id"] != draft["snapshot_id"]:
                raise self._invalid("Preparation must use the saved draft snapshot.")
            if payload["return_stage"] not in ("Prepare Data", "Data & Goal"):
                raise self._invalid("Return stage must be Prepare Data or Data & Goal.")
            options = self.options(experiment_id, workspace_id)
            if payload["issue_id"] is not None or payload["fix_id"] is not None:
                if not any(fix["issue_id"] == payload["issue_id"] and fix["fix_id"] == payload["fix_id"] for fix in options["fixes"]):
                    raise self._invalid("The issue and fix must be a server-issued pair for this snapshot.")
            snapshot = _snapshot_from_dict(self.service.get_snapshot(draft["snapshot_id"]))
            if len(snapshot.source_ids) != 1 or snapshot.relationship_ids:
                raise MLStudioServiceError("preparation_relationships_unsupported", "Preparation requires an unjoined primary source.", "Use a workspace without relationships.", status_code=409)
            raw_steps = payload["steps"]
            if not isinstance(raw_steps, list) or len(raw_steps) > 100:
                raise self._invalid("Provide at most 100 supported steps.")
            steps = []
            columns = tuple(column.name for column in snapshot.column_profile)
            for step in raw_steps:
                if not isinstance(step, dict) or set(step) - {"type", "params"} or not isinstance(step.get("params", {}), dict):
                    raise ValueError("invalid step")
                params = step.get("params", {})
                affected = params.get("columns") or list(columns)
                if not isinstance(affected, list) or any(not isinstance(column, str) or not column for column in affected):
                    raise ValueError("invalid affected fields")
                steps.append(TransformationStep(step_id=f"step-{uuid4().hex}", action_type=step["type"], affected_columns=tuple(affected), parameters=params))
            recipe_values = {"recipe_id": f"recipe-{uuid4().hex}", "workspace_id": workspace_id,
                             "base_snapshot_id": snapshot.snapshot_id, "base_recipe_hash": snapshot.transformation_recipe_hash,
                             "recipe_version": (draft["recipe_version"] or 0) + 1, "steps": tuple(steps)}
            recipe = TransformationRecipeLineage(**recipe_values,
                canonical_recipe_hash=TransformationRecipeLineage.calculate_hash(**recipe_values), created_at=self.service._clock())
            context = {"operation_id": f"preparation-{uuid4().hex}", "experiment_id": experiment_id,
                       "workspace_id": workspace_id, "base_draft_revision": draft["draft_revision"], "base_etag": etag,
                       "snapshot_id": snapshot.snapshot_id, "workspace_version": snapshot.workspace_version,
                       "source_id": snapshot.source_ids[0], "issue_id": payload["issue_id"], "fix_id": payload["fix_id"],
                       "return_stage": payload["return_stage"], "recipe": recipe.to_dict()}
            return {"preparation": self.repository.begin_preparation(context, key=key, intent_hash=intent_hash)}
        except PersistenceError as exc:
            raise self.service._translate_persistence(exc) from exc
        except (KeyError, TypeError, ValueError) as exc:
            if isinstance(exc, MLStudioServiceError):
                raise
            raise self._invalid("The supported cleaning recipe is invalid.") from exc

    @staticmethod
    def _cleaning_request(operation: dict, preview: bool) -> dict:
        return {"workspace_version": operation["workspace_version"], "source_id": operation["source_id"],
                "preview_only": preview, "steps": [{"type": step["action_type"], "params": step["parameters"]} for step in operation["recipe"]["steps"]]}

    def preview(self, operation_id: str, experiment_id: str, workspace_id: str) -> dict:
        operation = self._operation(operation_id, experiment_id, workspace_id)
        if operation["status"] != "open":
            raise MLStudioServiceError("preparation_terminal_conflict", "Preparation is terminal.", "Reload its outcome.", status_code=409)
        self.service._assert_snapshot_current(_snapshot_from_dict(self.service.get_snapshot(operation["snapshot_id"])))
        return {"preparation": operation, "preview": self.cleaner(workspace_id, self._cleaning_request(operation, True))}

    def finish(self, operation_id: str, experiment_id: str, workspace_id: str, etag: str, action: str) -> dict:
        if action not in ("apply", "cancel"):
            raise self._invalid("Action must be apply or cancel.")
        self._operation(operation_id, experiment_id, workspace_id)

        def execute(operation: dict) -> dict | None:
            receipt = self.receipt_lookup(operation_id, workspace_id)
            if action == "cancel":
                if receipt:
                    raise MLStudioServiceError("preparation_commit_pending", "Data was committed and the draft needs reconciliation.", "Retry Apply to finish the saved preparation operation.", status_code=409)
                return None
            if receipt is None:
                self.service._assert_snapshot_current(_snapshot_from_dict(self.service.get_snapshot(operation["snapshot_id"])))
                receipt = self.cleaner(workspace_id, self._cleaning_request(operation, False), preparation_id=operation_id)["receipt"]
            snapshot = self.service.resolve_preparation_snapshot(workspace_id)
            fingerprint = snapshot.source_fingerprints[0]
            if snapshot.workspace_version != receipt["workspace_version"] or snapshot.source_ids != (receipt["source_id"],) or fingerprint.content_fingerprint != receipt["content_fingerprint"] or fingerprint.schema_version != receipt["schema_version"]:
                raise MLStudioServiceError("preparation_workspace_conflict", "The workspace changed after preparation committed.", "Duplicate the draft and select a fresh snapshot; retain this operation as commit evidence.", status_code=409)
            return {"receipt": receipt, "snapshot": snapshot}

        try:
            operation = self.repository.finish_preparation(operation_id, experiment_id, workspace_id, etag, action, execute)
        except PersistenceError as exc:
            raise self.service._translate_persistence(exc) from exc
        return {"preparation": operation, **self.service.get_draft(experiment_id, workspace_id)}
