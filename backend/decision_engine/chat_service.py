"""AI Chat orchestration for Decision Intelligence."""

from __future__ import annotations

import hashlib
import json
import re
from calendar import monthrange
from copy import deepcopy
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

from backend.decision_engine.grounding import build_grounding_summary
from backend.decision_engine.mode_detection import (
    detect_chat_mode_details,
    is_decision_request,
    is_visualization_request,
)
from backend.services.aichat_nlp import (
    ChartBuildError,
    analyse_columns,
    build_chart_response,
    extract_dataset,
    interpret_nl_query,
)
from backend.services.dataset_context import resolve_analysis_dataset_bundle, resolve_dataset_bundle
from backend.services.decision_output_service import DecisionOutputService
from backend.services.decision_support import DecisionServiceError, build_dataset_trust
from backend.services.metric_resolver import MetricResolutionError, MetricResolver
from backend.services.decision_workspace_service import DecisionWorkspaceService
from backend.services.relationship_execution import resolve_active_model_analysis_context


_PREPARED_DATASET_SENTINEL = object()


class DecisionChatService:
    """
    Backend chat service for AI Chat-first Decision Intelligence.

    The service keeps the contract stable and grounded while decision review,
    analysis, and export are unified inside AI Chat.
    """

    CONTRACT_VERSION = "di_v3_phase4_5_chat_v1"
    BI_RESULT_CONTRACT_VERSION = "ai_chat_bi_result_v1"
    BI_GROUNDING_VERSION = "ai_chat_bi_grounding_v1"
    ANALYTICS_REFINEMENT_VERSION = "ai_chat_analytics_refinement_v1"
    ANALYTICS_REFINEMENT_OPERATIONS = {
        "remove_filter",
        "set_aggregation",
        "set_group_by",
        "set_time_period",
        "set_output",
    }
    # Keep this catalog explicit so frontend controls are driven by backend truth.
    DECISION_ACTION_CONTRACTS = {
        "draft_workspace": {
            "label": "Refresh workspace draft",
            "intent": "draft_workspace",
            "description": "Rebuild the workspace preview from the current chat decision state.",
            "payload_expectations": {
                "required_any": ["session_state.draft_workspace", "user_message"],
                "required_when_missing_workspace": ["user_message"],
                "optional": ["dataset", "dataset_ref", "semantic_model", "decision_intake"],
                "produces": ["workspace_preview", "session_state.draft_workspace"],
            },
        },
        "show_assumptions": {
            "label": "Show assumptions",
            "intent": "inspect_assumptions",
            "description": "Inspect the current assumptions being carried by the draft workspace.",
            "payload_expectations": {
                "required": ["session_state.draft_workspace"],
                "optional": ["decision_workspace"],
                "produces": ["workspace_analysis_summary"],
            },
        },
        "show_blockers": {
            "label": "Show blockers",
            "intent": "inspect_blockers",
            "description": "See the missing inputs or structural gaps that still limit deeper execution.",
            "payload_expectations": {
                "required": ["session_state.draft_workspace"],
                "optional": ["decision_workspace"],
                "produces": ["workspace_analysis_summary"],
            },
        },
        "analyze_workspace": {
            "label": "Analyze workspace",
            "intent": "run_observational_analysis",
            "description": "Run observational analysis against the current scoped workspace draft.",
            "payload_expectations": {
                "required": ["session_state.draft_workspace", "dataset"],
                "optional": ["dataset_ref", "semantic_model", "analysis_preferences", "decision_workspace"],
                "produces": ["workspace_analysis_summary"],
            },
        },
        "open_workspace": {
            # Compatibility id retained for older clients; visible copy should
            # describe AI Chat decision review, not the old Decisions window.
            "label": "Review decision output",
            "intent": "inspect_decision_output",
            "description": "Review the structured decision output in AI Chat without leaving the chat flow.",
            "payload_expectations": {
                "required": ["session_state.draft_workspace"],
                "optional": ["decision_workspace"],
                "produces": ["workspace_preview", "decision_review"],
            },
        },
    }
    ANALYTICS_INTENT_KEYWORDS = (
        "what is",
        "which",
        "highest",
        "lowest",
        "top",
        "bottom",
        "average",
        "avg",
        "mean",
        "sum",
        "total",
        "count",
        "breakdown",
        "compare",
        "by ",
        "per ",
        "trend",
    )

    @staticmethod
    def prepare_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve one truthful dataset identity before governance or analysis."""
        payload = dict(payload) if isinstance(payload, dict) else {}
        if payload.get("_dataset_identity_prepared") is _PREPARED_DATASET_SENTINEL:
            return payload

        semantic_model = payload.get("semantic_model") or payload.get("semanticModel")
        dataset_ref = payload.get("dataset_ref") or payload.get("datasetRef")
        normalized_ref = dict(dataset_ref) if isinstance(dataset_ref, dict) else {}
        session_state = payload.get("session_state") if isinstance(payload.get("session_state"), dict) else {}
        prior_dataset_context = (
            session_state.get("dataset_context")
            if isinstance(session_state.get("dataset_context"), dict)
            else {}
        )
        analysis_context = payload.get("analysis_context") or payload.get("analysisContext")
        explicit_workspace_id = str(
            payload.get("workspace_id") or payload.get("workspaceId") or ""
        ).strip()
        prior_analysis_context = (
            prior_dataset_context.get("analysis_context")
            if isinstance(prior_dataset_context.get("analysis_context"), dict)
            else {}
        )
        if (
            isinstance(analysis_context, dict)
            and explicit_workspace_id
            and str(analysis_context.get("workspace_id") or "").strip()
            != explicit_workspace_id
        ):
            raise DecisionServiceError(
                "workspace_context_mismatch: workspace_id does not match analysis_context."
            )
        if analysis_context is None:
            # A current workspace identity is enough to resolve the complete
            # active model. Re-resolve on refinements so client-carried joined
            # rows, relationship arrays, and lineage never become truth.
            resolver_workspace_id = explicit_workspace_id or str(
                prior_analysis_context.get("workspace_id") or ""
            ).strip()
            if resolver_workspace_id:
                try:
                    analysis_context = resolve_active_model_analysis_context(
                        resolver_workspace_id
                    )
                except ValueError as exc:
                    code = getattr(exc, "code", "active_data_model_invalid")
                    raise DecisionServiceError(f"{code}: {exc}") from exc
            elif payload.get("dataset") is None and not normalized_ref:
                # Preserve compatibility for a session created from an
                # explicitly supplied identity-only context.
                analysis_context = prior_analysis_context or None
        analysis_lineage = None
        multi_source_governance = None
        resolved_governance_policy = None
        requested_datasets = DecisionChatService._normalize_requested_datasets(
            payload.get("resolved_datasets") or payload.get("resolvedDatasets")
        )
        if len(requested_datasets) > 1 and not isinstance(analysis_context, dict):
            raise DecisionServiceError(
                "Decision Chat supports one analyzed dataset per turn; select one named dataset."
            )

        if requested_datasets and not isinstance(analysis_context, dict):
            if not normalized_ref:
                raise DecisionServiceError(
                    "The named dataset could not be verified. Send dataset_ref for the mentioned dataset or remove the mention."
                )
            requested_name = requested_datasets[0].casefold()
            reference_names = {
                str(normalized_ref.get("dataset_name") or "").strip().casefold(),
                str(normalized_ref.get("dataset_id") or "").strip().casefold(),
            } - {""}
            if requested_name not in reference_names:
                raise DecisionServiceError(
                    "The named dataset does not match dataset_ref; the request was refused before analysis."
                )

        dataset = extract_dataset(payload.get("dataset"))
        if isinstance(analysis_context, dict):
            try:
                bundle = resolve_analysis_dataset_bundle(analysis_context)
            except ValueError as exc:
                code = getattr(exc, "code", "analysis_context_invalid")
                raise DecisionServiceError(f"{code}: {exc}") from exc
            dataset = bundle["dataframe"].to_dict(orient="records")
            semantic_model = bundle.get("semantic_model")
            normalized_ref = DecisionChatService._safe_dataset_ref(bundle.get("dataset_ref"))
            analysis_context = bundle.get("analysis_context")
            analysis_lineage = bundle.get("analysis_lineage")
            if isinstance(analysis_lineage, dict):
                multi_source_governance = bundle.get("governance_readiness")
            else:
                resolved_governance_policy = bundle.get("governance_policy")
        should_load_reference = bool(normalized_ref) and (
            str(normalized_ref.get("source") or "").strip().lower() == "datahub"
            or (not dataset and bool(normalized_ref.get("dataset_id")))
        )
        if should_load_reference and not isinstance(analysis_context, dict):
            try:
                bundle = resolve_dataset_bundle(
                    dataset=None,
                    dataset_ref=normalized_ref,
                    # The caller's semantic model may describe the unrelated
                    # active dataset. Resolve model truth with the selected
                    # Data Hub record instead.
                    semantic_model=None,
                    source="decision_chat_identity",
                    allow_active_fallback=False,
                )
            except ValueError as exc:
                raise DecisionServiceError(
                    f"The selected dataset could not be resolved: {exc}"
                ) from exc
            dataset = bundle["dataframe"].to_dict(orient="records")
            semantic_model = bundle.get("semantic_model")
            loaded_ref = bundle.get("dataset_ref") if isinstance(bundle.get("dataset_ref"), dict) else {}
            normalized_ref = {
                **DecisionChatService._safe_dataset_ref(normalized_ref),
                **DecisionChatService._safe_dataset_ref(loaded_ref),
            }
        elif normalized_ref and not dataset:
            raise DecisionServiceError(
                "dataset_ref was supplied without a resolvable dataset; the request was refused before analysis."
            )
        else:
            normalized_ref = DecisionChatService._safe_dataset_ref(normalized_ref)

        dataset_context = DecisionChatService._build_dataset_context(
            dataset=dataset,
            dataset_ref=normalized_ref,
            semantic_model=semantic_model,
            analysis_context=analysis_context,
            analysis_lineage=analysis_lineage,
        )
        prepared = {
            **payload,
            "dataset": dataset or None,
            "semantic_model": semantic_model,
            "_dataset_identity_prepared": _PREPARED_DATASET_SENTINEL,
            "_resolved_dataset_context": dataset_context,
        }
        if isinstance(analysis_context, dict):
            prepared["analysis_context"] = analysis_context
        if isinstance(analysis_lineage, dict):
            prepared["_analysis_lineage"] = analysis_lineage
        if isinstance(multi_source_governance, dict):
            prepared["_multi_source_governance_readiness"] = multi_source_governance
        if isinstance(resolved_governance_policy, dict) and not (
            prepared.get("governance_policy") or prepared.get("governancePolicy")
        ):
            prepared["governance_policy"] = resolved_governance_policy
        prepared.pop("datasetRef", None)
        prepared.pop("analysisContext", None)
        prepared.pop("workspaceId", None)
        prepared.pop("semanticModel", None)
        prepared.pop("resolvedDatasets", None)
        if normalized_ref:
            prepared["dataset_ref"] = normalized_ref
        else:
            prepared.pop("dataset_ref", None)
        return prepared

    @staticmethod
    def handle_turn(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = DecisionChatService.prepare_payload(payload)
        user_message = str(payload.get("user_message") or "").strip()
        if not user_message:
            raise DecisionServiceError("user_message is required for decision chat turns.")

        dataset = extract_dataset(payload.get("dataset"))
        semantic_model = payload.get("semantic_model") or payload.get("semanticModel")
        session_state = DecisionChatService._normalize_session_state(payload.get("session_state"))
        analytics_refinement = DecisionChatService._normalize_analytics_refinement(
            payload.get("analytics_refinement") or payload.get("analyticsRefinement")
        )
        if analytics_refinement:
            prior_analytic_state = DecisionChatService._normalize_analytic_state(
                session_state.get("last_analytic_context")
            )
            if not prior_analytic_state:
                raise DecisionServiceError(
                    "analytics_refinement requires prior structured analytics state from session_state."
                )
            if prior_analytic_state.get("source") != "semantic_metric":
                raise DecisionServiceError(
                    "analytics_refinement currently requires semantic metric state; raw-field refinements are not supported."
                )
        dataset_context = payload.get("_resolved_dataset_context")
        session_state, dataset_changed = DecisionChatService._rebase_session_for_dataset(
            session_state,
            dataset_context,
        )
        conversation_context = DecisionChatService._build_conversation_context(
            payload.get("conversation_history"),
            session_state,
        )
        grounding_summary = build_grounding_summary(dataset, semantic_model)
        requested_mode = payload.get("requested_mode") or payload.get("requestedMode") or payload.get("mode")
        mode_details = detect_chat_mode_details(
            user_message,
            session_state,
            requested_mode=requested_mode,
        )
        clarification_resolution = DecisionChatService._resolve_clarification_response(
            payload=payload,
            user_message=user_message,
            clarification_state=session_state.get("clarification_state"),
            semantic_model=semantic_model,
        )
        if clarification_resolution and isinstance(session_state.get("draft_workspace"), dict):
            mode_details = DecisionChatService._override_mode_details(
                mode_details,
                mode="decide",
                reason_code="decision_clarification_response",
                reason="The message answers the current focused decision clarification.",
            )
        mode = mode_details["mode"]
        if (
            not clarification_resolution
            and
            mode != "explore"
            and mode_details.get("reason_code") in {"default_question", "continue_active_mode"}
            and DecisionChatService._should_attempt_analytics(user_message, dataset, semantic_model, session_state)
        ):
            mode = "explore"
            mode_details = DecisionChatService._override_mode_details(
                mode_details,
                mode="explore",
                reason_code="grounded_analytics_request",
                reason=(
                    "The message looks like a grounded analytical question against the active dataset, "
                    "so explore mode was used."
                ),
            )

        artifacts: List[Dict[str, Any]] = []
        warnings: List[str] = (
            ["The active dataset changed, so prior structured analysis state was cleared before this turn."]
            if dataset_changed
            else []
        )
        assistant_message = ""
        draft_workspace = DecisionChatService._extract_workspace(payload, session_state)
        workspace_analysis: Dict[str, Any] | None = None
        output_correction_result: Dict[str, Any] | None = None
        resolved_clarification: Dict[str, Any] | None = None
        available_actions: List[Dict[str, Any]] = []
        analytic_state = DecisionChatService._normalize_analytic_state(session_state.get("last_analytic_context"))

        if mode_details.get("requires_confirmation"):
            assistant_message = (
                "Should I explore this as a descriptive chart comparison, or frame it as a decision trade-off? "
                "Choose Explore or Decide and resend the request."
            )
            artifacts.append({
                "type": "answer",
                "title": "Choose an analysis mode",
                "content": {
                    "message": assistant_message,
                    "confirmation_modes": list(mode_details.get("confirmation_modes") or ["explore", "decide"]),
                },
            })

        # Explore mode now supports grounded analytics answers and stateful follow-up turns.
        elif mode == "explore" and dataset:
            stale_referential_follow_up = (
                dataset_changed
                and DecisionChatService._is_terse_analytic_follow_up(user_message)
                and DecisionChatService._find_semantic_metric_reference(user_message, semantic_model) is None
                and DecisionChatService._find_semantic_dimension_reference(user_message, semantic_model) is None
            )
            if stale_referential_follow_up:
                assistant_message = (
                    "The active dataset changed, so I cannot safely resolve that reference. "
                    "Name the metric or dimension you want to analyze in the new dataset."
                )
                artifacts.append({
                    "type": "answer",
                    "title": "Conversational context reset",
                    "content": {
                        "message": assistant_message,
                        "reason_code": "dataset_change_requires_explicit_context",
                    },
                })
            elif is_visualization_request(user_message):
                analytics_result = DecisionChatService._build_analytics_response(
                    user_message=user_message,
                    dataset=dataset,
                    semantic_model=semantic_model,
                    session_state=session_state,
                    conversation_context=conversation_context,
                    analytics_refinement=analytics_refinement,
                )
                if analytics_result is not None:
                    assistant_message = analytics_result["assistant_message"]
                    artifacts.extend(analytics_result["artifacts"])
                    available_actions = list(analytics_result.get("suggested_actions") or [])
                    analytic_state = analytics_result.get("analytic_state") or analytic_state
                else:
                    chart_artifact, assistant_message = DecisionChatService._build_chart_artifact(user_message, dataset)
                    artifacts.append(chart_artifact)
                    analytic_state = {
                        "schema_version": "ai_chat_analytics_state_v1",
                        "source": "raw_nlp",
                        "fields": dict((chart_artifact.get("content") or {}).get("fieldsUsed") or {}),
                        "aggregation": ((chart_artifact.get("content") or {}).get("chartSpec") or {}).get("aggregation") or "sum",
                        "group_by": [
                            value for value in (
                                ((chart_artifact.get("content") or {}).get("fieldsUsed") or {}).get("category"),
                                ((chart_artifact.get("content") or {}).get("fieldsUsed") or {}).get("time"),
                            ) if value
                        ],
                        "filters": list((chart_artifact.get("content") or {}).get("filtersApplied") or []),
                        "time_period": None,
                        "output_preference": "chart",
                        "last_user_message": user_message,
                    }
            else:
                analytics_result = DecisionChatService._build_analytics_response(
                    user_message=user_message,
                    dataset=dataset,
                    semantic_model=semantic_model,
                    session_state=session_state,
                    conversation_context=conversation_context,
                    analytics_refinement=analytics_refinement,
                )
                if analytics_result is not None:
                    assistant_message = analytics_result["assistant_message"]
                    artifacts.extend(analytics_result["artifacts"])
                    available_actions = list(analytics_result.get("suggested_actions") or [])
                    analytic_state = analytics_result.get("analytic_state") or analytic_state
                else:
                    assistant_message, reply_warnings = DecisionChatService._build_grounded_reply(user_message, grounding_summary)
                    warnings.extend(reply_warnings)
                    artifacts.append({
                        "type": "answer",
                        "title": "Grounded chat status",
                        "content": {
                            "message": assistant_message,
                        },
                    })

        # Decision prompts reuse the prompt-first workspace service. Textual
        # follow-up commands execute the same backend actions as explicit chips.
        elif mode == "decide":
            text_action = DecisionChatService._detect_decision_text_action(user_message)
            should_rebuild_workspace = DecisionChatService._should_rebuild_decision_workspace(
                payload=payload,
                session_state=session_state,
                user_message=user_message,
                mode_details=mode_details,
                draft_workspace=draft_workspace,
            )
            if should_rebuild_workspace:
                draft_workspace = DecisionChatService._create_draft_workspace(payload, user_message)
            elif clarification_resolution and draft_workspace is not None:
                action_result = DecisionChatService._execute_decision_action(
                    action="draft_workspace",
                    payload={
                        **payload,
                        "correction": clarification_resolution["correction"],
                    },
                    session_state=session_state,
                    workspace=draft_workspace,
                    user_message=user_message,
                )
                artifacts.extend(action_result["artifacts"])
                assistant_message = action_result["assistant_message"]
                warnings.extend(action_result.get("warnings") or [])
                draft_workspace = action_result["workspace"]
                output_correction_result = action_result.get("correction_result")
                resolved_clarification = {
                    "question_id": clarification_resolution["question_id"],
                    "choice_id": clarification_resolution["choice_id"],
                    "summary": assistant_message,
                }
            elif text_action and draft_workspace is not None:
                action_result = DecisionChatService._execute_decision_action(
                    action=text_action,
                    payload=payload,
                    session_state=session_state,
                    workspace=draft_workspace,
                    user_message=user_message,
                )
                artifacts.extend(action_result["artifacts"])
                assistant_message = action_result["assistant_message"]
                warnings.extend(action_result.get("warnings") or [])
                draft_workspace = action_result["workspace"]
                workspace_analysis = action_result.get("workspace_analysis")
                output_correction_result = action_result.get("correction_result")
            elif text_action and draft_workspace is None:
                assistant_message = "Frame a decision first, then I can show blockers, assumptions, or workspace analysis."
                artifacts.append({
                    "type": "answer",
                    "title": "Decision action needs a draft",
                    "content": {
                        "message": assistant_message,
                    },
                })
            elif draft_workspace is None:
                draft_workspace = DecisionChatService._create_draft_workspace(payload, user_message)
            if draft_workspace is not None and not artifacts:
                preview = DecisionChatService._build_workspace_preview(draft_workspace)
                artifacts.append(preview)
                assistant_message = DecisionChatService._build_workspace_preview_message(draft_workspace)
            available_actions = DecisionChatService._build_decision_actions(draft_workspace)

        else:
            assistant_message, reply_warnings = DecisionChatService._build_grounded_reply(user_message, grounding_summary)
            warnings.extend(reply_warnings)
            artifacts.append({
                "type": "answer",
                "title": "Grounded chat status",
                "content": {
                    "message": assistant_message,
                },
            })

        dataset_trust = DecisionChatService.build_dataset_trust_for_payload(payload, workspace=draft_workspace)
        scenario_preview = DecisionChatService._extract_scenario_preview(payload, session_state)
        decision_output = DecisionChatService._build_decision_output(
            workspace=None if mode_details.get("requires_confirmation") else draft_workspace,
            dataset_trust=dataset_trust,
            workspace_analysis=workspace_analysis,
            correction_result=output_correction_result,
            scenario_preview=scenario_preview,
            governance_readiness=payload.get("_governance_readiness"),
        )
        if decision_output is not None:
            artifacts.append(decision_output)
        normalized_actions = DecisionChatService._normalize_available_actions(available_actions, mode=mode)
        pending_clarification = DecisionChatService._build_clarification_state(
            workspace=draft_workspace if mode == "decide" else None,
            semantic_model=semantic_model,
        )
        response_clarification = DecisionChatService._build_response_clarification_state(
            pending=pending_clarification,
            resolved=resolved_clarification,
        )
        normalized_artifacts = DecisionChatService._attach_dataset_trust(
            DecisionChatService._annotate_artifacts(artifacts, mode=mode),
            dataset_trust,
        )
        normalized_artifacts, bi_grounding = DecisionChatService._attach_bi_grounding(
            artifacts=normalized_artifacts,
            payload=payload,
            dataset_trust=dataset_trust,
            semantic_model=semantic_model,
            analytic_state=analytic_state,
        )
        analytics_refinement_contract = DecisionChatService._build_analytics_refinement_contract(
            analytic_state=analytic_state,
            applied_refinement=analytics_refinement,
        )
        updated_state = DecisionChatService._build_session_state(
            session_state=session_state,
            mode=mode,
            mode_details=mode_details,
            user_message=user_message,
            available_actions=normalized_actions,
            analytic_state=analytic_state,
            draft_workspace=draft_workspace,
            grounding_summary=grounding_summary,
            dataset_context=dataset_context,
            clarification_state=pending_clarification,
        )
        DecisionChatService._attach_dataset_trust_to_state(updated_state, dataset_trust)
        # The top-level preview describes the active response artifact, while
        # session_state may still preserve a prior draft for later decision turns.
        response_workspace = draft_workspace if mode == "decide" else None
        draft_workspace_preview = (
            DecisionChatService._attach_dataset_trust(
                DecisionChatService._annotate_artifacts(
                    [DecisionChatService._build_workspace_preview(response_workspace)],
                    mode="decide",
                ),
                dataset_trust,
            )[0]
            if response_workspace is not None
            else None
        )

        return {
            "status": "success",
            "contract_version": DecisionChatService.BI_RESULT_CONTRACT_VERSION,
            "assistant_message": assistant_message,
            "mode": mode,
            "mode_context": updated_state["mode_context"],
            "action_state": updated_state["action_state"],
            "decision_readiness": DecisionChatService._build_response_readiness_state(
                mode=mode,
                workspace=draft_workspace,
                available_actions=normalized_actions,
            ),
            "capability_state": DecisionChatService._build_response_capability_state(
                mode=mode,
                workspace=draft_workspace,
                user_message=user_message,
            ),
            "suggested_actions": normalized_actions,
            "artifacts": normalized_artifacts,
            "draft_workspace_preview": draft_workspace_preview,
            "decision_output": decision_output,
            "clarification_state": response_clarification,
            "conversation_context": conversation_context,
            "dataset_trust": dataset_trust,
            "bi_grounding": bi_grounding,
            **({"analysis_context": dict(payload["analysis_context"])} if isinstance(payload.get("analysis_context"), dict) else {}),
            **({"analysis_lineage": deepcopy(payload["_analysis_lineage"])} if isinstance(payload.get("_analysis_lineage"), dict) else {}),
            "analytics_refinement": analytics_refinement_contract,
            "resolved_datasets": (
                [dict(dataset_context["dataset"])]
                if isinstance(dataset_context, dict) and isinstance(dataset_context.get("dataset"), dict)
                else []
            ),
            "session_state": updated_state,
            "grounding_summary": grounding_summary,
            "warnings": warnings,
        }

    @staticmethod
    def handle_action(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = DecisionChatService.prepare_payload(payload)
        action = str(payload.get("action") or payload.get("action_id") or "").strip().lower()
        if not action:
            raise DecisionServiceError("action is required for decision chat actions.")
        if action not in DecisionChatService.DECISION_ACTION_CONTRACTS:
            raise DecisionServiceError(f"Unsupported decision chat action: {action}")

        session_state = DecisionChatService._normalize_session_state(payload.get("session_state"))
        provided_dataset_context = payload.get("_resolved_dataset_context")
        DecisionChatService._assert_current_action_dataset(session_state, provided_dataset_context)
        dataset_context = provided_dataset_context or DecisionChatService._prior_dataset_context(session_state)
        workspace = DecisionChatService._extract_workspace(payload, session_state)
        mode_details = {
            "mode": "decide",
            "reason_code": "explicit_action",
            "reason": "A decision action was invoked explicitly, so decide mode is active.",
        }
        action_result = DecisionChatService._execute_decision_action(
            action=action,
            payload=payload,
            session_state=session_state,
            workspace=workspace,
            user_message=str(payload.get("user_message") or session_state.get("decision_prompt") or "").strip(),
        )
        artifacts = action_result["artifacts"]
        assistant_message = action_result["assistant_message"]
        warnings = list(action_result.get("warnings") or [])
        workspace = action_result["workspace"]
        correction_result = action_result.get("correction_result")
        correction_trace = action_result.get("trace")
        workspace_analysis = action_result.get("workspace_analysis")

        normalized_actions = DecisionChatService._normalize_available_actions(
            DecisionChatService._build_decision_actions(workspace) if workspace else [],
            mode="decide",
        )
        dataset_trust = DecisionChatService.build_dataset_trust_for_payload(payload, workspace=workspace)
        scenario_preview = DecisionChatService._extract_scenario_preview(payload, session_state)
        decision_output = DecisionChatService._build_decision_output(
            workspace=workspace,
            dataset_trust=dataset_trust,
            workspace_analysis=workspace_analysis,
            correction_result=correction_result,
            scenario_preview=scenario_preview,
            governance_readiness=payload.get("_governance_readiness"),
        )
        if decision_output is not None:
            artifacts.append(decision_output)
        pending_clarification = DecisionChatService._build_clarification_state(
            workspace=workspace,
            semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
        )
        normalized_artifacts = DecisionChatService._attach_dataset_trust(
            DecisionChatService._annotate_artifacts(artifacts, mode="decide"),
            dataset_trust,
        )
        updated_state = DecisionChatService._build_session_state(
            session_state=session_state,
            mode="decide",
            mode_details=mode_details,
            user_message=str(payload.get("user_message") or session_state.get("decision_prompt") or "").strip(),
            available_actions=normalized_actions,
            analytic_state=DecisionChatService._normalize_analytic_state(session_state.get("last_analytic_context")),
            draft_workspace=workspace,
            grounding_summary=None,
            dataset_context=dataset_context,
            clarification_state=pending_clarification,
        )
        DecisionChatService._attach_dataset_trust_to_state(updated_state, dataset_trust)

        return {
            "status": "success",
            "contract_version": DecisionChatService.CONTRACT_VERSION,
            "action": action,
            "mode": "decide",
            "mode_context": updated_state["mode_context"],
            "action_state": updated_state["action_state"],
            "decision_readiness": DecisionChatService._build_response_readiness_state(
                mode="decide",
                workspace=workspace,
                available_actions=normalized_actions,
            ),
            "capability_state": DecisionChatService._build_response_capability_state(
                mode="decide",
                workspace=workspace,
                user_message=str(payload.get("user_message") or session_state.get("decision_prompt") or "").strip(),
            ),
            "assistant_message": assistant_message,
            "executed_action": DecisionChatService._normalize_action_contract(action, mode="decide"),
            "suggested_actions": normalized_actions,
            "artifacts": normalized_artifacts,
            "decision_workspace": workspace,
            "decision_output": decision_output,
            "clarification_state": pending_clarification,
            "correction_result": correction_result,
            "trace": correction_trace,
            "dataset_trust": dataset_trust,
            **({"analysis_context": dict(payload["analysis_context"])} if isinstance(payload.get("analysis_context"), dict) else {}),
            **({"analysis_lineage": deepcopy(payload["_analysis_lineage"])} if isinstance(payload.get("_analysis_lineage"), dict) else {}),
            "resolved_datasets": (
                [dict(dataset_context["dataset"])]
                if isinstance(dataset_context, dict) and isinstance(dataset_context.get("dataset"), dict)
                else []
            ),
            "session_state": updated_state,
            "warnings": warnings,
        }

    @staticmethod
    def _normalize_requested_datasets(value: Any) -> List[str]:
        """Normalize mention resolution hints while preserving their declared identity."""
        if not isinstance(value, list):
            return []
        normalized: List[str] = []
        for item in value:
            if isinstance(item, dict):
                candidate = item.get("dataset_name") or item.get("name") or item.get("dataset_id") or item.get("id")
            else:
                candidate = item
            label = str(candidate or "").strip()
            if label and label.casefold() not in {existing.casefold() for existing in normalized}:
                normalized.append(label)
        return normalized

    @staticmethod
    def _safe_dataset_ref(dataset_ref: Any) -> Dict[str, Any]:
        """Keep public identity/readiness metadata and exclude local file paths."""
        if not isinstance(dataset_ref, dict):
            return {}
        allowed_fields = (
            "source",
            "dataset_id",
            "dataset_name",
            "transform_state",
            "transformation_state",
            "cleaning_state",
            "stale_state",
            "freshness_state",
            "is_cleaned",
            "is_stale",
            "freshness_as_of",
            "updated_at",
        )
        return {
            field: dataset_ref.get(field)
            for field in allowed_fields
            if dataset_ref.get(field) is not None
        }

    @staticmethod
    def _build_dataset_context(
        *,
        dataset: Any,
        dataset_ref: Dict[str, Any],
        semantic_model: Dict[str, Any] | None,
        analysis_context: Dict[str, Any] | None = None,
        analysis_lineage: Dict[str, Any] | None = None,
    ) -> Dict[str, Any] | None:
        """Build row-free session identity with a deterministic content fingerprint."""
        rows = extract_dataset(dataset)
        if not rows:
            return None
        semantic_dataset = (
            semantic_model.get("dataset")
            if isinstance(semantic_model, dict) and isinstance(semantic_model.get("dataset"), dict)
            else {}
        )
        summary = {
            "source": str(dataset_ref.get("source") or "inline").strip().lower() or "inline",
            "dataset_id": dataset_ref.get("dataset_id") or semantic_dataset.get("id"),
            "dataset_name": (
                dataset_ref.get("dataset_name")
                or semantic_dataset.get("name")
                or "Inline Dataset"
            ),
            "row_count": len(rows),
            "column_count": len(rows[0]) if rows else 0,
        }
        fingerprint_payload = {
            "dataset": summary,
            "rows": rows,
        }
        fingerprint = hashlib.sha256(
            json.dumps(
                fingerprint_payload,
                sort_keys=True,
                separators=(",", ":"),
                default=str,
            ).encode("utf-8")
        ).hexdigest()
        context = {
            "schema_version": "di_chat_dataset_context_v1",
            "fingerprint": fingerprint,
            "dataset": summary,
        }
        if isinstance(analysis_context, dict):
            context["analysis_context"] = dict(analysis_context)
        if isinstance(analysis_lineage, dict):
            # Lineage contains identities and aggregate diagnostics only.
            context["analysis_lineage"] = deepcopy(analysis_lineage)
        return context

    @staticmethod
    def _prior_dataset_context(session_state: Dict[str, Any]) -> Dict[str, Any] | None:
        context = session_state.get("dataset_context")
        if isinstance(context, dict) and isinstance(context.get("dataset"), dict):
            return context
        context_summary = session_state.get("context_summary")
        trust = context_summary.get("dataset_trust") if isinstance(context_summary, dict) else None
        summary = trust.get("dataset") if isinstance(trust, dict) else None
        if isinstance(summary, dict):
            return {"dataset": summary}
        return None

    @staticmethod
    def _dataset_context_changed(previous: Any, current: Any) -> bool:
        if not isinstance(previous, dict) or not isinstance(current, dict):
            return False
        previous_fingerprint = str(previous.get("fingerprint") or "").strip()
        current_fingerprint = str(current.get("fingerprint") or "").strip()
        if previous_fingerprint and current_fingerprint:
            return previous_fingerprint != current_fingerprint

        previous_summary = previous.get("dataset") if isinstance(previous.get("dataset"), dict) else {}
        current_summary = current.get("dataset") if isinstance(current.get("dataset"), dict) else {}
        for field in ("dataset_id", "dataset_name", "row_count", "column_count"):
            previous_value = previous_summary.get(field)
            current_value = current_summary.get(field)
            if previous_value is not None and current_value is not None and previous_value != current_value:
                return True
        return False

    @staticmethod
    def _rebase_session_for_dataset(
        session_state: Dict[str, Any],
        dataset_context: Dict[str, Any] | None,
    ) -> Tuple[Dict[str, Any], bool]:
        previous_context = DecisionChatService._prior_dataset_context(session_state)
        if not DecisionChatService._dataset_context_changed(previous_context, dataset_context):
            return session_state, False
        rebased = dict(session_state)
        for key in (
            "draft_workspace",
            "decision_state",
            "decision_prompt",
            "scenario_preview",
            "scenarioPreview",
            "last_analytic_context",
            "analytics_state",
            "available_actions",
            "action_state",
            "missing_inputs",
            "clarification_state",
        ):
            rebased.pop(key, None)
        return rebased, True

    @staticmethod
    def _assert_current_action_dataset(
        session_state: Dict[str, Any],
        dataset_context: Dict[str, Any] | None,
    ) -> None:
        previous_context = DecisionChatService._prior_dataset_context(session_state)
        if DecisionChatService._dataset_context_changed(previous_context, dataset_context):
            raise DecisionServiceError(
                "The active dataset changed after this decision state was created. Start a new turn before running an action."
            )

    @staticmethod
    def _build_conversation_context(
        conversation_history: Any,
        session_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Use bounded role/content history only to corroborate structured continuity.

        Raw history is deliberately not returned or persisted. Metric, filter,
        workspace, and dataset truth continue to come from the current dataset
        plus validated structured session state.
        """
        accepted: List[Tuple[str, str]] = []
        history = conversation_history if isinstance(conversation_history, list) else []
        for item in history[-10:]:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role") or "").strip().lower()
            content = str(item.get("content") or "").strip()
            if role not in {"user", "assistant"} or not content:
                continue
            accepted.append((role, content[:2000]))

        analytic_state = DecisionChatService._normalize_analytic_state(
            session_state.get("last_analytic_context") or session_state.get("analytics_state")
        )
        prior_message = DecisionChatService._normalize_text(analytic_state.get("last_user_message"))
        user_messages = [
            DecisionChatService._normalize_text(content)
            for role, content in accepted
            if role == "user"
        ]
        history_alignment = bool(prior_message and prior_message in user_messages[-3:])
        has_structured_context = bool(analytic_state or session_state.get("draft_workspace"))
        used_for_continuity = bool(has_structured_context and accepted)
        return {
            "schema_version": "di_conversation_context_v1",
            "accepted_turn_count": len(accepted),
            "accepted_roles": [role for role, _ in accepted],
            "has_prior_user_turn": bool(user_messages),
            "history_alignment": history_alignment,
            "used_for_continuity": used_for_continuity,
            "authoritative_source": "structured_session_state",
            "raw_history_persisted": False,
        }

    @staticmethod
    def _normalize_session_state(session_state: Any) -> Dict[str, Any]:
        raw_state = session_state if isinstance(session_state, dict) else {}
        normalized_state = dict(raw_state)
        active_mode = str(
            normalized_state.get("active_mode")
            or ((normalized_state.get("mode_context") or {}).get("current_mode") if isinstance(normalized_state.get("mode_context"), dict) else "")
            or ""
        ).strip().lower()
        if active_mode in {"ask", "explore", "decide"}:
            normalized_state["active_mode"] = active_mode

        analytic_state = normalized_state.get("analytics_state")
        if not isinstance(analytic_state, dict):
            analytic_state = normalized_state.get("last_analytic_context")
        analytic_state = DecisionChatService._normalize_analytic_state(analytic_state)
        if analytic_state:
            normalized_state["analytics_state"] = analytic_state
            normalized_state["last_analytic_context"] = analytic_state

        available_actions = normalized_state.get("available_actions")
        if isinstance(available_actions, list):
            normalized_state["available_actions"] = DecisionChatService._normalize_available_actions(
                available_actions,
                mode=normalized_state.get("active_mode") or "ask",
            )

        return normalized_state

    @staticmethod
    def _override_mode_details(
        mode_details: Dict[str, Any],
        *,
        mode: str,
        reason_code: str,
        reason: str,
    ) -> Dict[str, Any]:
        updated = dict(mode_details or {})
        updated["mode"] = mode
        updated["reason_code"] = reason_code
        updated["reason"] = reason
        return updated

    @staticmethod
    def _build_session_state(
        session_state: Dict[str, Any],
        *,
        mode: str,
        mode_details: Dict[str, Any],
        user_message: str,
        available_actions: List[Dict[str, Any]],
        analytic_state: Dict[str, Any] | None,
        draft_workspace: Dict[str, Any] | None,
        grounding_summary: Dict[str, Any] | None,
        dataset_context: Dict[str, Any] | None,
        clarification_state: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        previous_mode = str(session_state.get("active_mode") or "").strip().lower() or None
        preserved_state = dict(session_state)
        active_decision_prompt = ""
        if isinstance(draft_workspace, dict):
            active_decision_prompt = str(draft_workspace.get("decision_prompt") or "").strip()
        updated_state = {
            **preserved_state,
            "schema_version": (
                "di_phase4_5_session_state_v1"
                if mode == "decide"
                else "ai_chat_bi_session_state_v1"
            ),
            "active_mode": mode,
            "decision_prompt": active_decision_prompt or preserved_state.get("decision_prompt") or user_message,
        }
        if isinstance(dataset_context, dict):
            # This object contains only a digest and summary; raw rows never
            # enter session persistence.
            updated_state["dataset_context"] = dict(dataset_context)

        if analytic_state:
            updated_state["last_analytic_context"] = analytic_state
            updated_state["analytics_state"] = analytic_state

        if draft_workspace is not None:
            updated_state["draft_workspace"] = draft_workspace
        elif "draft_workspace" in updated_state:
            updated_state["draft_workspace"] = updated_state.get("draft_workspace")

        if clarification_state:
            updated_state["clarification_state"] = clarification_state
        else:
            updated_state.pop("clarification_state", None)

        decision_state = DecisionChatService._build_decision_state(
            draft_workspace if draft_workspace is not None else updated_state.get("draft_workspace")
        )
        updated_state["decision_state"] = decision_state
        updated_state["missing_inputs"] = list(decision_state.get("missing_inputs") or [])
        updated_state["available_actions"] = available_actions
        updated_state["action_state"] = DecisionChatService._build_action_state(mode, available_actions)
        updated_state["mode_context"] = DecisionChatService._build_mode_context(
            mode=mode,
            previous_mode=previous_mode,
            mode_details=mode_details,
        )
        if grounding_summary is not None:
            updated_state["context_summary"] = {
                "has_dataset": bool((grounding_summary.get("dataset") or {}).get("row_count")),
                "has_semantic_model": bool(
                    (grounding_summary.get("semantic_model") or {}).get("metric_count")
                    or (grounding_summary.get("semantic_model") or {}).get("dimension_count")
                ),
                "dataset": grounding_summary.get("dataset") or {},
                "semantic_model": grounding_summary.get("semantic_model") or {},
            }
        return updated_state

    @staticmethod
    def _build_mode_context(
        *,
        mode: str,
        previous_mode: str | None,
        mode_details: Dict[str, Any],
    ) -> Dict[str, Any]:
        confirmation_modes = list(mode_details.get("confirmation_modes") or [])
        return {
            "current_mode": mode,
            "current_mode_label": DecisionChatService._mode_label(mode),
            "previous_mode": previous_mode,
            "mode_changed": bool(previous_mode and previous_mode != mode),
            "reason_code": str(mode_details.get("reason_code") or "unspecified"),
            "reason": str(mode_details.get("reason") or "").strip(),
            "selection_source": str(mode_details.get("selection_source") or "auto"),
            "requires_confirmation": bool(mode_details.get("requires_confirmation")),
            "confirmation_modes": confirmation_modes,
            "available_modes": [
                {"mode": "auto", "label": "Auto"},
                {"mode": "ask", "label": "Ask data"},
                {"mode": "explore", "label": "Explore"},
                {"mode": "decide", "label": "Decide"},
            ],
        }

    @staticmethod
    def _build_action_state(mode: str, available_actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        enabled_actions = [
            action for action in available_actions
            if isinstance(action, dict) and action.get("enabled", True)
        ]
        disabled_actions = [
            action for action in available_actions
            if isinstance(action, dict) and not action.get("enabled", True)
        ]
        secondary_actions = [
            action for action in enabled_actions
            if str(action.get("priority") or "").strip().lower() == "secondary"
        ]
        primary_action = next(
            (
                action for action in enabled_actions
                if str(action.get("priority") or "").strip().lower() == "primary"
            ),
            enabled_actions[0] if enabled_actions else None,
        )
        return {
            "current_mode": mode,
            "has_actions": bool(enabled_actions),
            "available_action_ids": [
                str(action.get("action_id") or "").strip()
                for action in enabled_actions
                if str(action.get("action_id") or "").strip()
            ],
            "primary_action_id": str(primary_action.get("action_id") or "").strip() if primary_action else None,
            "secondary_action_ids": [
                str(action.get("action_id") or "").strip()
                for action in secondary_actions
                if str(action.get("action_id") or "").strip()
            ],
            "disabled_action_ids": [
                str(action.get("action_id") or "").strip()
                for action in disabled_actions
                if str(action.get("action_id") or "").strip()
            ],
            "empty_reason": (
                None
                if enabled_actions
                else "No explicit backend tool actions are available for the current state yet."
            ),
            "available_actions": available_actions,
        }

    @staticmethod
    def _build_decision_state(workspace: Any) -> Dict[str, Any]:
        if not isinstance(workspace, dict) or not workspace:
            return {
                "has_draft_workspace": False,
                "workspace_id": None,
                "workspace_status": None,
                "objective_draft": None,
                "lever_count": 0,
                "constraint_count": 0,
                "missing_inputs": [],
                "blocker_count": 0,
                "can_open_workspace": False,
                "can_analyze_workspace": False,
                "can_run_simulation": False,
            }

        preview = DecisionChatService._build_workspace_preview(workspace)
        readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else {}
        blockers = [
            item for item in (workspace.get("unknowns") or [])
            if isinstance(item, dict) and item.get("blocks_simulation")
        ]
        return {
            "has_draft_workspace": True,
            "workspace_id": workspace.get("workspace_id"),
            "workspace_status": workspace.get("status"),
            "objective_draft": preview.get("objective"),
            "lever_count": preview.get("lever_count") or 0,
            "constraint_count": preview.get("constraint_count") or 0,
            "missing_inputs": list(preview.get("missing_inputs") or []),
            "blocker_count": len(blockers),
            "can_open_workspace": True,
            "can_analyze_workspace": True,
            "can_run_simulation": bool(readiness.get("can_run_simulation")),
            "readiness_state": readiness.get("readiness_state"),
            "structural_readiness": readiness.get("structural_readiness") or {},
            "blocked_state": readiness.get("blocked_state") or {},
            "allowed_next_actions": list(readiness.get("allowed_next_actions") or []),
            "capability_state": readiness.get("capability_state") or {},
            "unsupported_capabilities": list(readiness.get("unsupported_capabilities") or []),
            "not_ready_for_recommendation": bool(readiness.get("not_ready_for_recommendation", True)),
        }

    @staticmethod
    def _build_response_readiness_state(
        *,
        mode: str,
        workspace: Dict[str, Any] | None,
        available_actions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not isinstance(workspace, dict) or not workspace:
            return {
                "current_mode": mode,
                "has_decision_frame": False,
                "workspace_status": None,
                "readiness_state": "not_applicable",
                "structural_readiness": {},
                "blocked_state": {"is_blocked": False, "blocked_action_ids": [], "blocking_missing_inputs": []},
                "allowed_next_actions": [],
                "primary_action_id": None,
                "missing_inputs": [],
            }

        readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else {}
        action_state = DecisionChatService._build_action_state(mode, available_actions)
        return {
            "current_mode": mode,
            "has_decision_frame": True,
            "workspace_id": workspace.get("workspace_id"),
            "workspace_status": workspace.get("status"),
            "readiness_state": readiness.get("readiness_state") or workspace.get("status"),
            "truth_boundary": readiness.get("truth_boundary") or "observational_analysis_only",
            "structural_readiness": readiness.get("structural_readiness") or {},
            "blocked_state": readiness.get("blocked_state") or {},
            "allowed_next_actions": list(readiness.get("allowed_next_actions") or []),
            "primary_action_id": action_state.get("primary_action_id"),
            "missing_inputs": list(readiness.get("missing_inputs") or []),
        }

    @staticmethod
    def _build_response_capability_state(
        *,
        mode: str,
        workspace: Dict[str, Any] | None,
        user_message: str,
    ) -> Dict[str, Any]:
        requested_capabilities = DecisionChatService._detect_requested_capabilities(user_message)
        if isinstance(workspace, dict):
            readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else {}
            capability_state = dict(readiness.get("capability_state") or {})
            unsupported = list(readiness.get("unsupported_capabilities") or [])
        else:
            capability_state = DecisionChatService._default_capability_state(mode)
            unsupported = ["simulation", "optimization", "autonomous_decisioning", "final_recommendation"]

        return {
            **capability_state,
            "requested_capabilities": requested_capabilities,
            "unsupported_requested_capabilities": [
                item for item in requested_capabilities if item in unsupported
            ],
            "truth_boundary": "observational_analysis_only",
        }

    @staticmethod
    def _default_capability_state(mode: str) -> Dict[str, Any]:
        return {
            "observational_analysis": {
                "supported": True,
                "available": mode == "explore",
                "status": "allowed" if mode == "explore" else "not_applicable",
                "reason": "Explore mode can answer grounded analytic questions when data is available.",
            },
            "workspace_open": {
                "supported": True,
                "available": False,
                "status": "blocked",
                "reason": "A decision workspace must be drafted before it can be opened.",
            },
            "simulation": DecisionChatService._unsupported_capability(
                "Causal simulation is not implemented in decision chat."
            ),
            "optimization": DecisionChatService._unsupported_capability(
                "Goal-seeking optimization is not implemented in decision chat."
            ),
            "autonomous_decisioning": DecisionChatService._unsupported_capability(
                "The system does not make autonomous decisions."
            ),
            "final_recommendation": DecisionChatService._unsupported_capability(
                "The system can provide observational decision support, not final recommendations."
            ),
        }

    @staticmethod
    def _unsupported_capability(reason: str) -> Dict[str, Any]:
        return {
            "supported": False,
            "available": False,
            "status": "unsupported",
            "reason": reason,
        }

    @staticmethod
    def _detect_requested_capabilities(user_message: str) -> List[str]:
        normalized = DecisionChatService._normalize_text(user_message)
        requested: List[str] = []
        checks = [
            ("simulation", ("simulate", "simulation", "what-if", "what if")),
            ("optimization", ("optimize", "optimise", "optimizer", "best allocation", "maximize", "minimize")),
            ("autonomous_decisioning", ("autonomous", "decide for me", "make the decision")),
            ("final_recommendation", ("final recommendation", "recommendation", "recommend ", "tell me what to do")),
        ]
        for capability, keywords in checks:
            if any(keyword in normalized for keyword in keywords):
                requested.append(capability)
        return requested

    @staticmethod
    def _normalize_available_actions(actions: Any, mode: str) -> List[Dict[str, Any]]:
        if not isinstance(actions, list):
            return []

        normalized_actions: List[Dict[str, Any]] = []
        for raw_action in actions:
            if not isinstance(raw_action, dict):
                continue
            action_id = str(raw_action.get("action_id") or "").strip()
            if not action_id:
                continue
            normalized_actions.append(DecisionChatService._normalize_action_contract(action_id, mode=mode, raw_action=raw_action))
        return normalized_actions

    @staticmethod
    def _normalize_action_contract(
        action_id: str,
        *,
        mode: str,
        raw_action: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        raw_action = raw_action if isinstance(raw_action, dict) else {}
        action_id = str(action_id or raw_action.get("action_id") or "").strip().lower()
        contract = DecisionChatService.DECISION_ACTION_CONTRACTS.get(action_id, {})
        analytics_refinement = raw_action.get("analytics_refinement")
        if isinstance(analytics_refinement, dict):
            analytics_refinement = DecisionChatService._normalize_analytics_refinement(analytics_refinement)
        else:
            analytics_refinement = None
        registered_action = bool(contract) or bool(analytics_refinement)
        label = str(raw_action.get("label") or contract.get("label") or action_id.replace("_", " ").title()).strip()
        description = str(raw_action.get("description") or contract.get("description") or "").strip() or None
        intent = str(raw_action.get("intent") or contract.get("intent") or action_id).strip().lower()
        priority = str(raw_action.get("priority") or "secondary").strip().lower() or "secondary"
        if priority not in {"primary", "secondary", "informational"}:
            priority = "secondary"
        payload_expectations = raw_action.get("payload_expectations")
        if not isinstance(payload_expectations, dict):
            payload_expectations = contract.get("payload_expectations") if isinstance(contract.get("payload_expectations"), dict) else {}
        enabled = bool(raw_action.get("enabled", True)) and registered_action
        availability_reason = str(raw_action.get("availability_reason") or "").strip() or None
        disabled_reason = str(raw_action.get("disabled_reason") or "").strip() or None
        if not registered_action:
            enabled = False
            disabled_reason = disabled_reason or "No backend action handler is registered for this action."
        elif not enabled:
            disabled_reason = disabled_reason or availability_reason or "This action is unavailable in the current state."
        normalized_action = {
            "action_id": action_id,
            "label": label,
            "intent": intent,
            "description": description,
            "mode": str(raw_action.get("mode") or mode).strip().lower() or mode,
            "kind": str(raw_action.get("kind") or "decision_tool").strip().lower() or "decision_tool",
            "priority": priority,
            "enabled": enabled,
            "availability_reason": availability_reason,
            "disabled_reason": disabled_reason,
            "payload_expectations": dict(payload_expectations),
        }
        if analytics_refinement:
            normalized_action["analytics_refinement"] = analytics_refinement
        return normalized_action

    @staticmethod
    def _build_action(
        *,
        action_id: str,
        label: str | None = None,
        description: str | None = None,
        mode: str,
        priority: str = "secondary",
        enabled: bool = True,
        kind: str = "decision_tool",
        availability_reason: str | None = None,
        intent: str | None = None,
        payload_expectations: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        contract = DecisionChatService.DECISION_ACTION_CONTRACTS.get(action_id, {})
        normalized_disabled_reason = (
            None
            if enabled
            else (availability_reason or "This action is unavailable in the current state.")
        )
        return {
            "action_id": action_id,
            "label": label or contract.get("label") or action_id.replace("_", " ").title(),
            "intent": intent or contract.get("intent") or action_id,
            "description": description or contract.get("description") or "",
            "mode": mode,
            "kind": kind,
            "priority": priority,
            "enabled": enabled,
            "availability_reason": availability_reason,
            "disabled_reason": normalized_disabled_reason,
            "payload_expectations": (
                payload_expectations
                if isinstance(payload_expectations, dict)
                else dict(contract.get("payload_expectations") or {})
            ),
        }

    @staticmethod
    def _build_analytics_refinement_contract(
        *,
        analytic_state: Dict[str, Any] | None,
        applied_refinement: Dict[str, Any] | None,
    ) -> Dict[str, Any] | None:
        """Expose current compact BI state and the accepted structured follow-up shape."""
        state = DecisionChatService._normalize_analytic_state(analytic_state)
        if not state:
            return None
        return {
            "schema_version": DecisionChatService.ANALYTICS_REFINEMENT_VERSION,
            "applied": dict(applied_refinement) if applied_refinement else None,
            "current_state": {
                "metric_id": state.get("metric_id"),
                "metric_name": state.get("metric_name"),
                "aggregation": state.get("aggregation"),
                "group_by": list(state.get("group_by") or [])[:4],
                "filters": [dict(item) for item in (state.get("filters") or [])[:8] if isinstance(item, dict)],
                "time_period": state.get("time_period") if isinstance(state.get("time_period"), dict) else None,
                "output_preference": state.get("output_preference"),
            },
            "payload_expectations": {
                "endpoint": "/api/decision/chat/turns",
                "required": ["user_message", "session_state", "analytics_refinement.operation", "analytics_refinement.arguments"],
                "operations": {
                    "remove_filter": {"required_arguments": ["field_or_dimension_id"]},
                    "set_aggregation": {
                        "required_arguments": ["aggregation"],
                        "allowed_aggregations": ["sum", "mean", "count", "min", "max", "nunique"],
                    },
                    "set_group_by": {"required_arguments": ["dimension_id_or_field"]},
                    "set_time_period": {"required_arguments": ["field_or_dimension_id", "start", "end"]},
                    "set_output": {
                        "required_arguments": ["output"],
                        "allowed_outputs": ["answer", "chart"],
                    },
                },
            },
        }

    @staticmethod
    def _build_analytics_suggested_actions(
        *,
        semantic_model: Dict[str, Any],
        analytic_state: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Create bounded, typed BI follow-ups from current semantic dimensions."""
        actions: List[Dict[str, Any]] = []
        grouped_fields = {str(item) for item in analytic_state.get("group_by") or [] if item}
        dimensions = [
            item for item in semantic_model.get("dimensions") or []
            if isinstance(item, dict) and item.get("field")
        ]
        payload_expectations = {
            "endpoint": "/api/decision/chat/turns",
            "required": ["user_message", "session_state", "analytics_refinement"],
            "produces": ["bi_grounding", "analytics_refinement", "suggested_actions", "artifacts"],
        }

        temporal_dimensions = [
            item for item in dimensions
            if str(item.get("semantic_kind") or "").lower() == "temporal"
            or str(item.get("data_type") or "").lower() in {"date", "datetime", "timestamp"}
        ]
        if temporal_dimensions:
            dimension = temporal_dimensions[0]
            field = str(dimension.get("field"))
            if field not in grouped_fields:
                actions.append({
                    "action_id": f"show_trend_by_{DecisionChatService._action_slug(field)}",
                    "label": f"Show trend by {dimension.get('label') or dimension.get('name') or field}",
                    "description": "Re-run the current metric as a time-series chart.",
                    "intent": "refine_analytics",
                    "kind": "analytics_refinement",
                    "priority": "primary",
                    "enabled": True,
                    "analytics_refinement": {
                        "operation": "set_group_by",
                        "arguments": {
                            "dimension_id": dimension.get("id"),
                            "field": field,
                            "output_preference": "chart",
                        },
                    },
                    "payload_expectations": payload_expectations,
                })

        categorical_count = 0
        for dimension in dimensions:
            field = str(dimension.get("field"))
            if field in grouped_fields or dimension in temporal_dimensions:
                continue
            actions.append({
                "action_id": f"breakdown_by_{DecisionChatService._action_slug(field)}",
                "label": f"Break down by {dimension.get('label') or dimension.get('name') or field}",
                "description": "Re-run the current metric grouped by this semantic dimension.",
                "intent": "refine_analytics",
                "kind": "analytics_refinement",
                "priority": "secondary",
                "enabled": True,
                "analytics_refinement": {
                    "operation": "set_group_by",
                    "arguments": {"dimension_id": dimension.get("id"), "field": field},
                },
                "payload_expectations": payload_expectations,
            })
            categorical_count += 1
            if categorical_count >= 2:
                break

        filter_fields: List[str] = []
        for filter_item in analytic_state.get("filters") or []:
            field = str(filter_item.get("field") or "") if isinstance(filter_item, dict) else ""
            if field and field not in filter_fields:
                filter_fields.append(field)
        for field in filter_fields[:2]:
            actions.append({
                "action_id": f"remove_filter_{DecisionChatService._action_slug(field)}",
                "label": f"Remove {field} filter",
                "description": "Re-run the current analysis without this filter.",
                "intent": "refine_analytics",
                "kind": "analytics_refinement",
                "priority": "secondary",
                "enabled": True,
                "analytics_refinement": {"operation": "remove_filter", "arguments": {"field": field}},
                "payload_expectations": payload_expectations,
            })

        current_aggregation = str(analytic_state.get("aggregation") or "").lower()
        alternate_aggregation = "mean" if current_aggregation != "mean" else "sum"
        actions.append({
            "action_id": f"set_aggregation_{alternate_aggregation}",
            "label": f"Use {alternate_aggregation} aggregation",
            "description": "Re-run the current semantic metric with a request-local aggregation override.",
            "intent": "refine_analytics",
            "kind": "analytics_refinement",
            "priority": "secondary",
            "enabled": True,
            "analytics_refinement": {
                "operation": "set_aggregation",
                "arguments": {"aggregation": alternate_aggregation},
            },
            "payload_expectations": payload_expectations,
        })
        return actions[:6]

    @staticmethod
    def _action_slug(value: Any) -> str:
        return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_") or "field"

    @staticmethod
    def _annotate_artifacts(artifacts: List[Dict[str, Any]], mode: str) -> List[Dict[str, Any]]:
        annotated: List[Dict[str, Any]] = []
        for index, artifact in enumerate(artifacts):
            if not isinstance(artifact, dict):
                continue
            defaults = DecisionChatService._artifact_defaults(str(artifact.get("type") or "").strip().lower())
            source = DecisionChatService._infer_artifact_source(artifact)
            annotated.append({
                **artifact,
                "artifact_id": str(artifact.get("artifact_id") or f"artifact_{mode}_{index + 1}_{artifact.get('type') or 'unknown'}"),
                "render_hint": str(artifact.get("render_hint") or defaults["render_hint"]),
                "inspectable": bool(artifact.get("inspectable", defaults["inspectable"])),
                "default_view": str(artifact.get("default_view") or defaults["default_view"]),
                "source": str(artifact.get("source") or source),
                "mode": str(artifact.get("mode") or mode),
                "schema_version": str(artifact.get("schema_version") or "di_phase4_5_artifact_v1"),
            })
        return annotated

    @staticmethod
    def build_dataset_trust_for_payload(
        payload: Dict[str, Any],
        *,
        workspace: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        semantic_model = payload.get("semantic_model") or payload.get("semanticModel")
        dataset_summary = workspace.get("dataset") if isinstance(workspace, dict) else None
        return build_dataset_trust(
            dataset=extract_dataset(payload.get("dataset")),
            dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
            semantic_model=semantic_model,
            dataset_summary=dataset_summary,
        )

    @staticmethod
    def _attach_dataset_trust(
        artifacts: List[Dict[str, Any]],
        dataset_trust: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        trusted_artifacts: List[Dict[str, Any]] = []
        for artifact in artifacts:
            if not isinstance(artifact, dict):
                continue
            trusted_artifacts.append({
                **artifact,
                "dataset_trust": dict(dataset_trust),
            })
        return trusted_artifacts

    @staticmethod
    def _attach_dataset_trust_to_state(
        session_state: Dict[str, Any],
        dataset_trust: Dict[str, Any],
    ) -> None:
        # Session state carries the same compact trust object so later actions
        # can display source context even before the unified artifact exists.
        context_summary = session_state.get("context_summary")
        if isinstance(context_summary, dict):
            context_summary["dataset_trust"] = dict(dataset_trust)
        decision_state = session_state.get("decision_state")
        if isinstance(decision_state, dict):
            decision_state["dataset_trust"] = dict(dataset_trust)

    @staticmethod
    def _attach_bi_grounding(
        *,
        artifacts: List[Dict[str, Any]],
        payload: Dict[str, Any],
        dataset_trust: Dict[str, Any],
        semantic_model: Dict[str, Any] | None,
        analytic_state: Dict[str, Any] | None,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Attach normalized BI lineage to every answer and chart artifact."""
        grounded_artifacts: List[Dict[str, Any]] = []
        primary_grounding: Dict[str, Any] | None = None
        for artifact in artifacts:
            if not isinstance(artifact, dict):
                continue
            if str(artifact.get("type") or "").lower() in {"answer", "table", "chart"}:
                grounding = DecisionChatService._build_bi_grounding(
                    payload=payload,
                    dataset_trust=dataset_trust,
                    semantic_model=semantic_model,
                    analytic_state=analytic_state,
                    artifact=artifact,
                )
                lineage = payload.get("_analysis_lineage")
                grounded_artifacts.append({
                    **artifact,
                    "bi_grounding": grounding,
                    **({"analysis_lineage": deepcopy(lineage)} if isinstance(lineage, dict) else {}),
                })
                primary_grounding = primary_grounding or grounding
            else:
                grounded_artifacts.append(artifact)
        if primary_grounding is None:
            primary_grounding = DecisionChatService._build_bi_grounding(
                payload=payload,
                dataset_trust=dataset_trust,
                semantic_model=semantic_model,
                analytic_state=analytic_state,
                artifact={},
            )
        return grounded_artifacts, primary_grounding

    @staticmethod
    def _build_bi_grounding(
        *,
        payload: Dict[str, Any],
        dataset_trust: Dict[str, Any],
        semantic_model: Dict[str, Any] | None,
        analytic_state: Dict[str, Any] | None,
        artifact: Dict[str, Any],
    ) -> Dict[str, Any]:
        state = DecisionChatService._normalize_analytic_state(analytic_state)
        content = artifact.get("content") if isinstance(artifact.get("content"), dict) else {}
        result_context = content.get("result_context") if isinstance(content.get("result_context"), dict) else {}
        evidence = result_context.get("evidence") if isinstance(result_context.get("evidence"), dict) else {}
        dataset = dict(dataset_trust.get("dataset") or {})

        metric_definition = content.get("metric") if isinstance(content.get("metric"), dict) else None
        if metric_definition is None:
            metric_definition = DecisionChatService._find_semantic_metric_by_reference(
                state.get("metric_id") or state.get("metric_name"),
                semantic_model,
            )
        fields_used = content.get("fieldsUsed") if isinstance(content.get("fieldsUsed"), dict) else {}
        if metric_definition is None and fields_used.get("value"):
            metric_definition = {
                "id": None,
                "name": fields_used.get("value"),
                "label": fields_used.get("value"),
                "field": fields_used.get("value"),
                "default_aggregation": state.get("aggregation") or content.get("aggregation") or "sum",
                "format_hint": None,
                "expression": {"type": "column_aggregation", "column": fields_used.get("value")},
            }
        metric_definition = dict(metric_definition) if isinstance(metric_definition, dict) else None

        aggregation = state.get("aggregation")
        if not aggregation and metric_definition:
            aggregation = metric_definition.get("default_aggregation") or (metric_definition.get("expression") or {}).get("aggregation")
        if not aggregation:
            chart_spec = content.get("chartSpec") if isinstance(content.get("chartSpec"), dict) else {}
            aggregation = content.get("aggregation") or chart_spec.get("aggregation")

        filters = evidence.get("filters") or content.get("filters") or content.get("filtersApplied") or state.get("filters") or []
        normalized_filters = [dict(item) for item in filters if isinstance(item, dict)][:8]
        group_fields = list(state.get("group_by") or evidence.get("group_by") or [])
        if not group_fields:
            group_fields = [value for value in (fields_used.get("category"), fields_used.get("time")) if value]
        dimensions: List[Dict[str, Any]] = []
        for field in group_fields[:4]:
            definition = DecisionChatService._find_semantic_dimension_by_reference(field, semantic_model)
            dimensions.append({
                "id": (definition or {}).get("id"),
                "name": (definition or {}).get("name") or field,
                "label": (definition or {}).get("label") or field,
                "field": (definition or {}).get("field") or field,
                "semantic_kind": (definition or {}).get("semantic_kind"),
                "data_type": (definition or {}).get("data_type"),
            })

        time_period = state.get("time_period") if isinstance(state.get("time_period"), dict) else None
        if time_period is None:
            time_period = DecisionChatService._extract_time_period(normalized_filters, semantic_model)
        filtered_row_count = evidence.get("filtered_row_count")
        if filtered_row_count is None:
            filtered_row_count = content.get("row_count")
        if filtered_row_count is None:
            filtered_row_count = dataset_trust.get("row_count") or 0
        source_row_count = evidence.get("source_row_count")
        if source_row_count is None:
            source_row_count = dataset_trust.get("row_count") or dataset.get("row_count") or 0
        dataset_ref = payload.get("dataset_ref") if isinstance(payload.get("dataset_ref"), dict) else {}
        grounding = {
            "schema_version": DecisionChatService.BI_GROUNDING_VERSION,
            "dataset": dataset or None,
            "row_count": int(filtered_row_count or 0),
            "source_row_count": int(source_row_count or 0),
            "freshness": {
                "state": dataset_trust.get("stale_state") or "unknown",
                "as_of": dataset_ref.get("freshness_as_of") or dataset_ref.get("updated_at"),
            },
            "cleaning": {"state": dataset_trust.get("transform_state") or "unknown"},
            "metric_definition": metric_definition,
            "aggregation": aggregation,
            "dimensions": dimensions,
            "filters": normalized_filters,
            "time_period": time_period,
            "output_type": artifact.get("type") or None,
        }
        lineage = payload.get("_analysis_lineage")
        if isinstance(lineage, dict):
            grounding["analysis_lineage"] = deepcopy(lineage)
        return grounding

    @staticmethod
    def _artifact_defaults(artifact_type: str) -> Dict[str, Any]:
        defaults = {
            "answer": {
                "render_hint": "answer",
                "inspectable": False,
                "default_view": "inline",
            },
            "chart": {
                "render_hint": "chart",
                "inspectable": True,
                "default_view": "inspector",
            },
            "workspace_preview": {
                "render_hint": "workspace_preview",
                "inspectable": True,
                "default_view": "inline_and_inspector",
            },
            "workspace_analysis_summary": {
                "render_hint": "workspace_analysis_summary",
                "inspectable": True,
                "default_view": "inspector",
            },
            "decision_output": {
                "render_hint": "decision_output",
                "inspectable": True,
                "default_view": "inspector",
            },
            "coming_soon": {
                "render_hint": "coming_soon",
                "inspectable": False,
                "default_view": "inline",
            },
        }
        return defaults.get(
            artifact_type,
            {
                "render_hint": artifact_type or "unknown",
                "inspectable": False,
                "default_view": "inline",
            },
        )

    @staticmethod
    def _infer_artifact_source(artifact: Dict[str, Any]) -> str:
        artifact_type = str(artifact.get("type") or "").strip().lower()
        content = artifact.get("content") if isinstance(artifact.get("content"), dict) else {}
        if artifact_type == "chart":
            return str((content.get("meta") or {}).get("source") or "chart_engine")
        if artifact_type == "workspace_preview":
            return "decision_workspace"
        if artifact_type == "workspace_analysis_summary":
            return "workspace_analysis"
        if artifact_type == "decision_output":
            return "decision_output"
        if artifact_type == "answer":
            if content.get("metric"):
                return "semantic_metric"
            if content.get("fieldsUsed"):
                return "raw_nlp"
            return "grounding"
        return "decision_chat"

    @staticmethod
    def _build_decision_output(
        *,
        workspace: Dict[str, Any] | None,
        dataset_trust: Dict[str, Any],
        workspace_analysis: Dict[str, Any] | None = None,
        correction_result: Dict[str, Any] | None = None,
        scenario_preview: Dict[str, Any] | None = None,
        governance_readiness: Dict[str, Any] | None = None,
    ) -> Dict[str, Any] | None:
        """Compose the display artifact while keeping Evidence Board normalization centralized."""
        if not isinstance(workspace, dict) or not workspace:
            return None
        return DecisionOutputService.compose(
            workspace=workspace,
            dataset_trust=dataset_trust,
            workspace_analysis=workspace_analysis,
            correction_result=correction_result,
            scenario_preview=scenario_preview,
            governance_readiness=governance_readiness,
        )

    @staticmethod
    def _mode_label(mode: str) -> str:
        labels = {
            "ask": "Ask data",
            "explore": "Explore",
            "decide": "Decide",
        }
        return labels.get(mode, mode.title() if mode else "Ask")

    @staticmethod
    def _extract_workspace(payload: Dict[str, Any], session_state: Dict[str, Any]) -> Dict[str, Any] | None:
        workspace = payload.get("decision_workspace") or payload.get("decisionWorkspace")
        if isinstance(workspace, dict):
            return workspace
        workspace = session_state.get("draft_workspace")
        return workspace if isinstance(workspace, dict) else None

    @staticmethod
    def _extract_scenario_preview(payload: Dict[str, Any], session_state: Dict[str, Any]) -> Dict[str, Any] | None:
        """Accept a precomputed bounded scenario preview without running scenario evaluation in chat."""
        scenario_preview = payload.get("scenario_preview") or payload.get("scenarioPreview")
        if isinstance(scenario_preview, dict):
            return scenario_preview
        scenario_preview = session_state.get("scenario_preview") or session_state.get("scenarioPreview")
        return scenario_preview if isinstance(scenario_preview, dict) else None

    @staticmethod
    def _build_clarification_state(
        *,
        workspace: Dict[str, Any] | None,
        semantic_model: Dict[str, Any] | None,
    ) -> Dict[str, Any] | None:
        """Build one deterministic, answerable clarification from backend truth."""
        if not isinstance(workspace, dict):
            return None
        readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else {}
        missing_inputs = list(readiness.get("missing_inputs") or [])
        if "objective.metric_id_or_metric_name" not in missing_inputs:
            return None

        metrics = semantic_model.get("metrics") if isinstance(semantic_model, dict) else []
        choices: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for metric in metrics or []:
            if not isinstance(metric, dict):
                continue
            choice_id = str(metric.get("id") or "").strip()
            label = str(metric.get("label") or metric.get("name") or "").strip()
            if not choice_id or not label or choice_id in seen:
                continue
            seen.add(choice_id)
            choices.append({
                "choice_id": choice_id,
                "label": label,
                "description": f"Use {label} as the decision success metric.",
            })
            if len(choices) >= 6:
                break

        hints = list(((workspace.get("drafting") or {}).get("clarification_hints")) or [])
        prompt = next(
            (str(item).strip() for item in hints if str(item).strip().lower().startswith("which ")),
            "Which metric should define success for this decision?",
        )
        return {
            "schema_version": "di_clarification_v1",
            "status": "pending",
            "question_id": "objective_metric",
            "missing_input": "objective.metric_id_or_metric_name",
            "prompt": prompt,
            "response_kind": "single_choice_or_exact_text",
            "choices": choices,
            "accepts_text": True,
            "text_constraint": "Enter one exact metric label or choice ID from the current semantic model.",
            "correction_type": "objective_metric",
            "target_path": "decision_scope.objective.metric_ref",
        }

    @staticmethod
    def _resolve_clarification_response(
        *,
        payload: Dict[str, Any],
        user_message: str,
        clarification_state: Any,
        semantic_model: Dict[str, Any] | None,
    ) -> Dict[str, Any] | None:
        """Resolve only an exact current-model choice; never infer free-form workspace state."""
        if not isinstance(clarification_state, dict) or clarification_state.get("status") != "pending":
            return None
        if clarification_state.get("question_id") != "objective_metric":
            return None

        response = payload.get("clarification_response") or payload.get("clarificationResponse")
        if isinstance(response, dict):
            structured_choice_id = response.get("choice_id") or response.get("choiceId")
            answer = structured_choice_id or response.get("text") or response.get("value")
        else:
            structured_choice_id = None
            answer = user_message
        normalized_answer = DecisionChatService._normalize_text(answer)
        if not normalized_answer:
            return None

        declared_choices = {
            str(item.get("choice_id") or "").strip()
            for item in (clarification_state.get("choices") or [])
            if isinstance(item, dict) and str(item.get("choice_id") or "").strip()
        }
        metrics = semantic_model.get("metrics") if isinstance(semantic_model, dict) else []
        matches: List[Dict[str, Any]] = []
        for metric in metrics or []:
            if not isinstance(metric, dict):
                continue
            metric_id = str(metric.get("id") or "").strip()
            if structured_choice_id and declared_choices and metric_id not in declared_choices:
                continue
            candidates = {
                DecisionChatService._normalize_text(metric.get("id")),
                DecisionChatService._normalize_text(metric.get("label")),
                DecisionChatService._normalize_text(metric.get("name")),
            } - {""}
            if normalized_answer in candidates:
                matches.append(metric)
        if len(matches) != 1:
            return None

        metric = matches[0]
        metric_id = str(metric.get("id") or "").strip()
        return {
            "question_id": "objective_metric",
            "choice_id": metric_id,
            "correction": {
                "correction_type": "objective_metric",
                "target_path": "decision_scope.objective.metric_ref",
                "replacement": {
                    "metric_id": metric_id,
                    "metric_name": metric.get("label") or metric.get("name"),
                },
                "reason": "Focused AI Chat clarification response.",
            },
        }

    @staticmethod
    def _build_response_clarification_state(
        *,
        pending: Dict[str, Any] | None,
        resolved: Dict[str, Any] | None,
    ) -> Dict[str, Any] | None:
        if resolved:
            return {
                "schema_version": "di_clarification_v1",
                "status": "resolved",
                **resolved,
                "next_question": pending,
            }
        return pending

    @staticmethod
    def _should_rebuild_decision_workspace(
        *,
        payload: Dict[str, Any],
        session_state: Dict[str, Any],
        user_message: str,
        mode_details: Dict[str, Any],
        draft_workspace: Dict[str, Any] | None,
    ) -> bool:
        """Detect when a new decision question should replace stale chat draft state."""
        explicit_decision_request = (
            (mode_details or {}).get("reason_code") == "decision_request"
            or is_decision_request(user_message)
        )
        if not explicit_decision_request:
            return False
        if isinstance(payload.get("decision_workspace") or payload.get("decisionWorkspace"), dict):
            return False

        normalized_message = DecisionWorkspaceService._normalize_phrase(user_message)
        if not normalized_message:
            return False

        existing_prompt = ""
        if isinstance(draft_workspace, dict):
            existing_prompt = str(draft_workspace.get("decision_prompt") or "").strip()
        if not existing_prompt:
            existing_prompt = str(session_state.get("decision_prompt") or "").strip()
        normalized_existing = DecisionWorkspaceService._normalize_phrase(existing_prompt)

        return bool(not normalized_existing or normalized_existing != normalized_message)

    @staticmethod
    def _detect_decision_text_action(user_message: str) -> str | None:
        """Map plain chat follow-ups to deterministic decision backend actions."""
        normalized = DecisionChatService._normalize_text(user_message)
        if not normalized:
            return None
        if "analyze workspace" in normalized or "analyse workspace" in normalized:
            return "analyze_workspace"
        if "open workspace" in normalized:
            return "open_workspace"
        if "assumption" in normalized:
            return "show_assumptions"
        if "blocker" in normalized or "missing input" in normalized or "what is missing" in normalized:
            return "show_blockers"
        if "draft workspace" in normalized or "refresh workspace" in normalized:
            return "draft_workspace"
        return None

    @staticmethod
    def _execute_decision_action(
        *,
        action: str,
        payload: Dict[str, Any],
        session_state: Dict[str, Any],
        workspace: Dict[str, Any] | None,
        user_message: str,
    ) -> Dict[str, Any]:
        """Execute decision actions for both explicit action calls and typed chat follow-ups."""
        if action not in DecisionChatService.DECISION_ACTION_CONTRACTS:
            raise DecisionServiceError(f"Unsupported decision chat action: {action}")
        artifacts: List[Dict[str, Any]] = []
        warnings: List[str] = []
        workspace_analysis: Dict[str, Any] | None = None
        assistant_message = ""

        if action == "draft_workspace":
            if isinstance(payload.get("correction"), dict):
                if workspace is None:
                    raise DecisionServiceError("A draft workspace is required before corrections can be applied.")
                correction_payload = {
                    "dataset": payload.get("dataset"),
                    "dataset_ref": payload.get("dataset_ref") or payload.get("datasetRef"),
                    "semantic_model": payload.get("semantic_model") or payload.get("semanticModel"),
                    "decision_workspace": workspace,
                    "correction": payload.get("correction"),
                }
                correction_result = DecisionWorkspaceService.correct_workspace(correction_payload)
                workspace = correction_result.get("decision_workspace") or workspace
                preview = DecisionChatService._build_workspace_preview(workspace)
                artifacts.append({
                    **preview,
                    "action_id": action,
                    "response_kind": action,
                    "correction_result": correction_result.get("correction_result"),
                    "trace": correction_result.get("trace"),
                })
                assistant_message = (
                    (correction_result.get("correction_result") or {}).get("summary")
                    or "The decision workspace correction was applied."
                )
                return {
                    "artifacts": artifacts,
                    "assistant_message": assistant_message,
                    "workspace": workspace,
                    "warnings": list(correction_result.get("warnings") or []),
                    "correction_result": correction_result.get("correction_result"),
                    "trace": correction_result.get("trace"),
                }

            prompt = str(user_message or session_state.get("decision_prompt") or "").strip()
            if workspace is None:
                if not prompt:
                    raise DecisionServiceError("A decision prompt is required before a workspace can be drafted.")
                workspace = DecisionChatService._create_draft_workspace(payload, prompt)
            elif (
                prompt
                and DecisionWorkspaceService._normalize_phrase(prompt)
                != DecisionWorkspaceService._normalize_phrase(workspace.get("decision_prompt"))
            ):
                workspace = DecisionChatService._create_draft_workspace(payload, prompt)
            artifacts.append({
                **DecisionChatService._build_workspace_preview(workspace),
                "action_id": action,
                "response_kind": action,
            })
            assistant_message = DecisionChatService._build_workspace_preview_message(workspace)

        elif action == "show_assumptions":
            if workspace is None:
                raise DecisionServiceError("A draft workspace is required before assumptions can be shown.")
            assumptions = list(workspace.get("assumptions") or [])
            artifacts.append(DecisionChatService._build_action_summary_artifact(
                action_id=action,
                title="Current assumptions",
                workspace=workspace,
                content={
                    "items": assumptions,
                    "count": len(assumptions),
                },
            ))
            assistant_message = (
                "These are the current assumptions in the decision draft."
                if assumptions
                else "The current draft does not yet have explicit assumptions."
            )

        elif action == "show_blockers":
            if workspace is None:
                raise DecisionServiceError("A draft workspace is required before blockers can be shown.")
            blockers = [
                item for item in (workspace.get("unknowns") or [])
                if isinstance(item, dict) and item.get("blocks_simulation")
            ]
            artifacts.append(DecisionChatService._build_action_summary_artifact(
                action_id=action,
                title="Current blockers",
                workspace=workspace,
                content={
                    "items": blockers,
                    "missing_inputs": list((workspace.get("readiness") or {}).get("missing_inputs") or []),
                    "count": len(blockers),
                },
            ))
            assistant_message = (
                "These gaps currently block deeper decision execution."
                if blockers
                else "The current draft does not show blocking gaps."
            )

        elif action == "analyze_workspace":
            if workspace is None:
                raise DecisionServiceError("A draft workspace is required before workspace analysis can run.")
            analysis_payload = {
                "dataset": payload.get("dataset"),
                "dataset_ref": payload.get("dataset_ref") or payload.get("datasetRef"),
                "semantic_model": payload.get("semantic_model") or payload.get("semanticModel"),
                "decision_workspace": workspace,
                "analysis_preferences": payload.get("analysis_preferences") or {},
            }
            analysis_result = DecisionWorkspaceService.analyze_workspace(analysis_payload)
            workspace_analysis = analysis_result.get("workspace_analysis") or {}
            analysis_summary = workspace_analysis.get("summary")
            summary_headline = (
                analysis_summary.get("headline")
                if isinstance(analysis_summary, dict)
                else str(analysis_summary or "").strip()
            )
            artifacts.append(DecisionChatService._build_action_summary_artifact(
                action_id=action,
                title="Workspace analysis",
                workspace=workspace,
                content={
                    "summary": DecisionChatService._normalize_analysis_summary(analysis_summary),
                    "truthfulness_note": (
                        workspace_analysis.get("truthfulness_note")
                        or DecisionChatService._decision_truthfulness_note()
                    ),
                    "scoped_diagnostics": workspace_analysis.get("scoped_diagnostics") or [],
                    "ranked_diagnostics": workspace_analysis.get("ranked_diagnostics") or [],
                    "legacy_diagnostics": workspace_analysis.get("legacy_diagnostics") or {},
                    "observational_boundary": (
                        workspace_analysis.get("observational_boundary")
                        or "observational_analysis_only"
                    ),
                },
            ))
            assistant_message = summary_headline or "Workspace analysis completed using the current scoped draft."
            warnings = list(analysis_result.get("warnings") or [])

        elif action == "open_workspace":
            if workspace is None:
                raise DecisionServiceError("A draft workspace is required before decision output can be reviewed.")
            preview = DecisionChatService._build_workspace_preview(workspace)
            artifacts.append({
                **preview,
                "title": "Decision output review",
                "action_id": action,
                "response_kind": action,
                "review_target": {
                    "surface": "ai_chat",
                    "artifact_type": "decision_output",
                    "workspace_id": workspace.get("workspace_id"),
                    "workspace_status": workspace.get("status"),
                },
            })
            assistant_message = (
                "Review this decision output in AI Chat. Use analysis, blockers, assumptions, graph, "
                "or export actions from the chat result when they are available."
            )

        return {
            "artifacts": artifacts,
            "assistant_message": assistant_message,
            "workspace": workspace,
            "warnings": warnings,
            "workspace_analysis": workspace_analysis,
        }

    @staticmethod
    def _create_draft_workspace(payload: Dict[str, Any], user_message: str) -> Dict[str, Any]:
        workspace_payload = {
            "dataset": payload.get("dataset"),
            "dataset_ref": payload.get("dataset_ref") or payload.get("datasetRef"),
            "semantic_model": payload.get("semantic_model") or payload.get("semanticModel"),
            "decision_prompt": user_message,
            "decision_intake": payload.get("decision_intake") or payload.get("decisionIntake") or {},
            "intake_mode": "prompt_first",
        }
        result = DecisionWorkspaceService.create_workspace(workspace_payload)
        return result.get("decision_workspace") or {}

    @staticmethod
    def _build_chart_artifact(user_message: str, dataset: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], str]:
        columns = analyse_columns(dataset)
        interpretation = interpret_nl_query(user_message, columns)
        chart_response = DecisionChatService._build_grounded_chart_response(
            dataset,
            interpretation,
        )
        chart_data = DecisionChatService._chart_data_with_display_meta(chart_response)
        fields_used = {key: value for key, value in (interpretation.get("fields") or {}).items() if value}
        chart_type = chart_response.get("chartType") or interpretation.get("chart_type") or "Bar"
        filters_applied = interpretation.get("filters") or []
        meta = chart_response.get("meta") or {}
        explanation = chart_response.get("explanation") or f"Generated a {chart_type.lower()} chart from the grounded dataset."

        return {
            "type": "chart",
            "title": f"{chart_type} chart",
            "content": {
                "chartType": chart_type,
                "chartData": chart_data,
                "fieldsUsed": fields_used,
                "filtersApplied": filters_applied,
                "meta": meta,
                "chartSpec": DecisionChatService._build_raw_chart_spec(
                    title=f"{chart_type} chart",
                    chart_type=chart_type,
                    fields=fields_used,
                    filters=filters_applied,
                    meta=meta,
                ),
            },
        }, explanation

    @staticmethod
    def _build_grounded_chart_response(
        dataset: List[Dict[str, Any]],
        interpretation: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Translate chart construction failures into the Decision Chat contract."""
        try:
            return build_chart_response(dataset, interpretation)
        except ChartBuildError as exc:
            raise DecisionServiceError(f"{exc.code}: {exc}") from exc

    @staticmethod
    def _display_field_label(field: Any) -> str:
        """Humanize one raw field without changing its execution identity."""
        unqualified = str(field or "").rsplit(".", 1)[-1]
        camel_spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", unqualified)
        words = re.findall(r"[A-Za-z]+|\d+", camel_spaced.replace("_", " "))
        return " ".join(word.capitalize() for word in words if word)

    @staticmethod
    def _chart_data_with_display_meta(chart_response: Dict[str, Any]) -> Dict[str, Any]:
        """Embed readable Chart.js axis metadata in the rendered data object."""
        chart_data = dict(chart_response.get("chartData") or {})
        source_meta = dict(chart_response.get("meta") or {})
        existing_meta = (
            dict(chart_data.get("meta"))
            if isinstance(chart_data.get("meta"), dict)
            else {}
        )
        axis_labels = {
            "x": DecisionChatService._display_field_label(source_meta.get("xLabel")),
            "y": DecisionChatService._display_field_label(source_meta.get("yLabel")),
        }
        chart_data["meta"] = {
            **source_meta,
            **existing_meta,
            "chartType": chart_response.get("chartType") or source_meta.get("type"),
            "axisLabels": {
                key: value
                for key, value in axis_labels.items()
                if value
            },
        }
        return chart_data

    @staticmethod
    def _should_attempt_analytics(
        user_message: str,
        dataset: List[Dict[str, Any]],
        semantic_model: Dict[str, Any] | None,
        session_state: Dict[str, Any],
    ) -> bool:
        """Route plain-language metric questions into explore mode when the query looks analytic."""
        if not dataset:
            return False
        lowered = str(user_message or "").strip().lower()
        if session_state.get("last_analytic_context"):
            return True
        if DecisionChatService._find_semantic_metric_reference(user_message, semantic_model):
            return True
        return any(keyword in lowered for keyword in DecisionChatService.ANALYTICS_INTENT_KEYWORDS)

    @staticmethod
    def _build_analytics_response(
        user_message: str,
        dataset: List[Dict[str, Any]],
        semantic_model: Dict[str, Any] | None,
        session_state: Dict[str, Any],
        conversation_context: Dict[str, Any] | None = None,
        analytics_refinement: Dict[str, Any] | None = None,
    ) -> Dict[str, Any] | None:
        """
        Build a grounded analytics response.

        Slice 2 supports two deterministic paths:
        - semantic metrics when they can be resolved from the semantic model
        - raw-field NLP analytics using the existing deterministic parser
        """
        analytic_state = DecisionChatService._normalize_analytic_state(session_state.get("last_analytic_context"))
        semantic_response = DecisionChatService._build_semantic_metric_response(
            user_message=user_message,
            dataset=dataset,
            semantic_model=semantic_model,
            analytic_state=analytic_state,
            conversation_context=conversation_context,
            analytics_refinement=analytics_refinement,
        )
        if semantic_response is not None:
            return semantic_response

        raw_response = DecisionChatService._build_raw_analytics_response(
            user_message=user_message,
            dataset=dataset,
            analytic_state=analytic_state,
            conversation_context=conversation_context,
            analytics_refinement=analytics_refinement,
        )
        return raw_response

    @staticmethod
    def _build_semantic_metric_response(
        user_message: str,
        dataset: List[Dict[str, Any]],
        semantic_model: Dict[str, Any] | None,
        analytic_state: Dict[str, Any],
        conversation_context: Dict[str, Any] | None = None,
        analytics_refinement: Dict[str, Any] | None = None,
    ) -> Dict[str, Any] | None:
        semantic_model = semantic_model if isinstance(semantic_model, dict) else {}
        metric_ref = DecisionChatService._find_semantic_metric_reference(user_message, semantic_model)
        dimension_ref = DecisionChatService._find_semantic_dimension_reference(user_message, semantic_model)
        prior_group_by = list(analytic_state.get("group_by") or [])
        prior_metric_id = analytic_state.get("metric_id")
        prior_metric_name = analytic_state.get("metric_name")

        # Follow-up turns can reuse the last metric or grouping if the user is clearly refining the same question.
        if metric_ref is None and analytic_state.get("source") == "semantic_metric":
            if prior_metric_id or prior_metric_name:
                metric_ref = {"id": prior_metric_id, "label": prior_metric_name}
        if dimension_ref is None and analytic_state.get("source") == "semantic_metric" and prior_group_by:
            dimension_ref = {"field": prior_group_by[0], "label": prior_group_by[0]}

        if metric_ref is None:
            return None

        refinement_operation = str((analytics_refinement or {}).get("operation") or "")
        refinement_arguments = (
            (analytics_refinement or {}).get("arguments")
            if isinstance((analytics_refinement or {}).get("arguments"), dict)
            else {}
        )
        if refinement_operation == "set_group_by":
            requested_dimension = (
                refinement_arguments.get("dimension_id")
                or refinement_arguments.get("field")
                or refinement_arguments.get("dimension")
            )
            dimension_ref = DecisionChatService._find_semantic_dimension_by_reference(
                requested_dimension,
                semantic_model,
            )
            if dimension_ref is None:
                raise DecisionServiceError(
                    f"Analytics grouping dimension '{requested_dimension}' is not available in the semantic model."
                )

        prefer_chart = DecisionChatService._should_return_chart(user_message, analytic_state)
        if refinement_operation == "set_output":
            prefer_chart = refinement_arguments.get("output") == "chart"
        elif refinement_arguments.get("output_preference") in {"answer", "chart"}:
            prefer_chart = refinement_arguments.get("output_preference") == "chart"
        group_by = [dimension_ref.get("id") or dimension_ref.get("field")] if isinstance(dimension_ref, dict) and (dimension_ref.get("id") or dimension_ref.get("field")) else []
        filters = DecisionChatService._build_semantic_filters(
            user_message=user_message,
            dataset=dataset,
            semantic_model=semantic_model,
            analytic_state=analytic_state,
            analytics_refinement=analytics_refinement,
        )

        metric_definition = DecisionChatService._find_semantic_metric_by_reference(
            metric_ref.get("id") or metric_ref.get("label") or metric_ref.get("name"),
            semantic_model,
        )
        aggregation_override = (
            refinement_arguments.get("aggregation")
            if refinement_operation == "set_aggregation"
            else None
        )
        if aggregation_override:
            if metric_definition is None:
                raise DecisionServiceError("The current semantic metric cannot accept an aggregation refinement.")
            metric_definition = DecisionChatService._override_metric_aggregation(
                metric_definition,
                str(aggregation_override),
            )

        try:
            metric_result = MetricResolver.resolve(
                metric=metric_definition if aggregation_override else None,
                metric_id=None if aggregation_override else metric_ref.get("id"),
                metric_name=None if aggregation_override else metric_ref.get("label") or metric_ref.get("name"),
                dataset=dataset,
                semantic_model=semantic_model,
                group_by=group_by,
                filters=filters,
                limit=8 if prefer_chart else 5,
                sort="value_desc" if group_by else None,
            )
        except MetricResolutionError as exc:
            if exc.code == "metric_measure_not_numeric":
                raise DecisionServiceError(f"{exc.code}: {exc}") from exc
            return None

        if prefer_chart and metric_result.get("group_by"):
            artifact = DecisionChatService._build_metric_chart_artifact(metric_result)
        else:
            artifact = DecisionChatService._build_metric_answer_artifact(metric_result)

        resolved_state = {
            "schema_version": "ai_chat_analytics_state_v1",
            "source": "semantic_metric",
            "metric_id": (metric_result.get("metric") or {}).get("id"),
            "metric_name": (metric_result.get("metric") or {}).get("label") or (metric_result.get("metric") or {}).get("name"),
            "aggregation": (metric_result.get("execution") or {}).get("resolved_aggregation"),
            "group_by": [item.get("field") for item in (metric_result.get("group_by") or []) if item.get("field")],
            "filters": list(metric_result.get("filters") or []),
            "time_period": DecisionChatService._extract_time_period(
                metric_result.get("filters") or [],
                semantic_model,
            ),
            "output_preference": "chart" if artifact.get("type") == "chart" else "answer",
            "last_user_message": user_message,
            "continuity_source": DecisionChatService._continuity_source(
                analytic_state,
                conversation_context,
            ),
        }
        return {
            "assistant_message": DecisionChatService._build_metric_summary_message(metric_result),
            "artifacts": [artifact],
            "analytic_state": resolved_state,
            "suggested_actions": DecisionChatService._build_analytics_suggested_actions(
                semantic_model=semantic_model,
                analytic_state=resolved_state,
            ),
        }

    @staticmethod
    def _build_raw_analytics_response(
        user_message: str,
        dataset: List[Dict[str, Any]],
        analytic_state: Dict[str, Any],
        conversation_context: Dict[str, Any] | None = None,
        analytics_refinement: Dict[str, Any] | None = None,
    ) -> Dict[str, Any] | None:
        refinement_operation = str((analytics_refinement or {}).get("operation") or "")
        refinement_arguments = (
            (analytics_refinement or {}).get("arguments")
            if isinstance((analytics_refinement or {}).get("arguments"), dict)
            else {}
        )
        columns = analyse_columns(dataset)
        interpretation = interpret_nl_query(user_message, columns)
        merged_fields = DecisionChatService._merge_raw_fields(
            current_fields=interpretation.get("fields") or {},
            analytic_state=analytic_state,
        )
        if not any(merged_fields.values()):
            return None

        prefer_chart = DecisionChatService._should_return_chart(user_message, analytic_state)
        if refinement_operation == "set_output":
            prefer_chart = refinement_arguments.get("output") == "chart"
        if prefer_chart:
            chart_response = DecisionChatService._build_grounded_chart_response(
                dataset,
                {
                    **interpretation,
                    "fields": merged_fields,
                },
            )
            chart_data = DecisionChatService._chart_data_with_display_meta(
                chart_response
            )
            if chart_data.get("datasets"):
                chart_type = chart_response.get("chartType") or interpretation.get("chart_type") or "Bar"
                fields_used = {key: value for key, value in merged_fields.items() if value}
                filters_applied = interpretation.get("filters") or []
                meta = chart_response.get("meta") or {}
                artifact = {
                    "type": "chart",
                    "title": f"{chart_type} chart",
                    "content": {
                        "chartType": chart_type,
                        "chartData": chart_data,
                        "fieldsUsed": fields_used,
                        "filtersApplied": filters_applied,
                        "meta": meta,
                        "chartSpec": DecisionChatService._build_raw_chart_spec(
                            title=f"{chart_type} chart",
                            chart_type=chart_type,
                            fields=fields_used,
                            filters=filters_applied,
                            meta=meta,
                        ),
                    },
                }
                return {
                    "assistant_message": f"Generated a {chart_type.lower()} chart from the grounded dataset.",
                    "artifacts": [artifact],
                    "analytic_state": {
                        "schema_version": "ai_chat_analytics_state_v1",
                        "source": "raw_nlp",
                        "fields": {key: value for key, value in merged_fields.items() if value},
                        "aggregation": "sum",
                        "group_by": [
                            value for value in (merged_fields.get("category"), merged_fields.get("time")) if value
                        ],
                        "filters": list(filters_applied),
                        "time_period": None,
                        "output_preference": "chart",
                        "last_user_message": user_message,
                        "continuity_source": DecisionChatService._continuity_source(
                            analytic_state,
                            conversation_context,
                        ),
                    },
                    "suggested_actions": [],
                }

        summary_result = DecisionChatService._build_raw_summary(dataset, merged_fields, user_message)
        if summary_result is None:
            return None

        return {
            "assistant_message": summary_result["assistant_message"],
            "artifacts": [summary_result["artifact"]],
            "analytic_state": {
                "schema_version": "ai_chat_analytics_state_v1",
                "source": "raw_nlp",
                "fields": {key: value for key, value in merged_fields.items() if value},
                "aggregation": summary_result["artifact"].get("content", {}).get("aggregation"),
                "group_by": [
                    value for value in (merged_fields.get("category"), merged_fields.get("time")) if value
                ],
                "filters": [],
                "time_period": None,
                "output_preference": "answer",
                "last_user_message": user_message,
                "continuity_source": DecisionChatService._continuity_source(
                    analytic_state,
                    conversation_context,
                ),
            },
            "suggested_actions": [],
        }

    @staticmethod
    def _merge_raw_fields(current_fields: Dict[str, Any], analytic_state: Dict[str, Any]) -> Dict[str, Any]:
        merged_fields = dict(current_fields or {})
        if analytic_state.get("source") != "raw_nlp":
            return merged_fields
        prior_fields = analytic_state.get("fields") if isinstance(analytic_state.get("fields"), dict) else {}
        for key in ("value", "category", "time", "secondary_value"):
            if not merged_fields.get(key) and prior_fields.get(key):
                merged_fields[key] = prior_fields.get(key)
        return merged_fields

    @staticmethod
    def _continuity_source(
        analytic_state: Dict[str, Any],
        conversation_context: Dict[str, Any] | None,
    ) -> str:
        if not analytic_state:
            return "new_request"
        if isinstance(conversation_context, dict) and conversation_context.get("used_for_continuity"):
            return "structured_state_with_bounded_history"
        return "structured_session_state"

    @staticmethod
    def _build_semantic_filters(
        *,
        user_message: str,
        dataset: List[Dict[str, Any]],
        semantic_model: Dict[str, Any],
        analytic_state: Dict[str, Any],
        analytics_refinement: Dict[str, Any] | None = None,
    ) -> List[Dict[str, Any]]:
        """Carry and refine only filters grounded in current dimensions and values."""
        carried = (
            [dict(item) for item in (analytic_state.get("filters") or []) if isinstance(item, dict)]
            if analytic_state.get("source") == "semantic_metric"
            else []
        )
        dimensions = semantic_model.get("dimensions") if isinstance(semantic_model, dict) else []
        # Qualified field identities are valid execution references, but their
        # namespace words are not evidence that a dimension value was asked
        # for. Remove them before comparing the prompt with row values.
        filter_query = str(user_message or "")
        technical_references: List[str] = []
        for collection in ("metrics", "dimensions"):
            for definition in semantic_model.get(collection) or []:
                if not isinstance(definition, dict):
                    continue
                for key in ("field", "name", "id", "qualified_label"):
                    reference = str(definition.get(key) or "").strip()
                    if "." in reference:
                        technical_references.append(reference)
        for reference in sorted(set(technical_references), key=len, reverse=True):
            filter_query = re.sub(
                re.escape(reference),
                " ",
                filter_query,
                flags=re.IGNORECASE,
            )
        filter_query = re.sub(
            r"(?<!\w)[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*(?!\w)",
            " ",
            filter_query,
        )
        normalized_query = DecisionChatService._normalize_text(filter_query)

        for dimension in dimensions or []:
            if not isinstance(dimension, dict):
                continue
            field = str(dimension.get("field") or "").strip()
            if not field or not any(field in row for row in dataset if isinstance(row, dict)):
                continue
            semantic_kind = str(dimension.get("semantic_kind") or "").strip().lower()
            data_type = str(dimension.get("data_type") or "").strip().lower()
            if semantic_kind == "temporal" or data_type in {"date", "datetime", "timestamp"}:
                continue

            dimension_terms = {
                DecisionChatService._normalize_text(dimension.get("label")),
                DecisionChatService._normalize_text(dimension.get("name")),
                DecisionChatService._normalize_text(field),
            } - {""}
            if any(f"all {term}" in normalized_query for term in dimension_terms):
                carried = [item for item in carried if item.get("field") != field]
                continue

            values: List[Any] = []
            seen_values: set[str] = set()
            for row in dataset:
                value = row.get(field) if isinstance(row, dict) else None
                normalized_value = DecisionChatService._normalize_text(value)
                if not normalized_value or normalized_value in seen_values:
                    continue
                seen_values.add(normalized_value)
                if re.search(rf"(?<!\w){re.escape(normalized_value)}(?!\w)", normalized_query):
                    values.append(value)
                if len(seen_values) >= 100:
                    break
            if values:
                carried = [item for item in carried if item.get("field") != field]
                carried.append({
                    "field": field,
                    "operator": "eq" if len(values) == 1 else "in",
                    "value": values[0] if len(values) == 1 else None,
                    "values": values if len(values) > 1 else None,
                })

        period_update = DecisionChatService._detect_period_filter_update(
            user_message=user_message,
            dataset=dataset,
            dimensions=dimensions or [],
        )
        if period_update:
            period_field = period_update[0]["field"]
            carried = [item for item in carried if item.get("field") != period_field]
            carried.extend(period_update)
        carried = DecisionChatService._apply_refinement_to_filters(
            filters=carried,
            analytics_refinement=analytics_refinement,
            semantic_model=semantic_model,
        )
        return carried[:8]

    @staticmethod
    def _detect_period_filter_update(
        *,
        user_message: str,
        dataset: List[Dict[str, Any]],
        dimensions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        temporal = next(
            (
                item for item in dimensions
                if isinstance(item, dict)
                and (
                    str(item.get("semantic_kind") or "").strip().lower() == "temporal"
                    or str(item.get("data_type") or "").strip().lower() in {"date", "datetime", "timestamp"}
                )
                and str(item.get("field") or "").strip()
            ),
            None,
        )
        if not temporal:
            return []
        field = str(temporal.get("field"))
        normalized = DecisionChatService._normalize_text(user_message)

        explicit_range = re.search(
            r"\bfrom\s+(\d{4}-\d{2}-\d{2})\s+(?:to|through|until)\s+(\d{4}-\d{2}-\d{2})\b",
            normalized,
        )
        if explicit_range:
            start, end = explicit_range.groups()
            return [
                {"field": field, "operator": "gte", "value": start},
                {"field": field, "operator": "lte", "value": end},
            ]

        quarter = re.search(r"\bq([1-4])(?:\s+|-)?(20\d{2})\b", normalized)
        if quarter:
            quarter_number = int(quarter.group(1))
            year = int(quarter.group(2))
            start_month = (quarter_number - 1) * 3 + 1
            end_month = start_month + 2
            start = f"{year:04d}-{start_month:02d}-01"
            end = f"{year:04d}-{end_month:02d}-{monthrange(year, end_month)[1]:02d}"
            return [
                {"field": field, "operator": "gte", "value": start},
                {"field": field, "operator": "lte", "value": end},
            ]

        month_names = {
            name: index
            for index, name in enumerate(
                ("january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"),
                start=1,
            )
        }
        month_match = re.search(
            rf"\b({'|'.join(month_names)})\s+(20\d{{2}})\b",
            normalized,
        )
        if month_match:
            month = month_names[month_match.group(1)]
            year = int(month_match.group(2))
            return [
                {"field": field, "operator": "gte", "value": f"{year:04d}-{month:02d}-01"},
                {
                    "field": field,
                    "operator": "lte",
                    "value": f"{year:04d}-{month:02d}-{monthrange(year, month)[1]:02d}",
                },
            ]
        return []

    @staticmethod
    def _normalize_analytic_state(analytic_state: Any) -> Dict[str, Any]:
        return analytic_state if isinstance(analytic_state, dict) else {}

    @staticmethod
    def _normalize_analytics_refinement(value: Any) -> Dict[str, Any] | None:
        """Validate a structured BI follow-up before it can alter resolver inputs."""
        if value is None:
            return None
        if not isinstance(value, dict):
            raise DecisionServiceError("analytics_refinement must be an object when provided.")
        operation = str(value.get("operation") or "").strip().lower()
        if operation not in DecisionChatService.ANALYTICS_REFINEMENT_OPERATIONS:
            supported = ", ".join(sorted(DecisionChatService.ANALYTICS_REFINEMENT_OPERATIONS))
            raise DecisionServiceError(f"Unsupported analytics_refinement operation. Supported operations: {supported}.")
        arguments = value.get("arguments")
        if not isinstance(arguments, dict):
            raise DecisionServiceError("analytics_refinement.arguments must be an object.")

        normalized_arguments = dict(arguments)
        if operation == "remove_filter":
            field = str(arguments.get("field") or arguments.get("dimension_id") or "").strip()
            if not field:
                raise DecisionServiceError("remove_filter requires arguments.field or arguments.dimension_id.")
        elif operation == "set_aggregation":
            aggregation = str(arguments.get("aggregation") or "").strip().lower()
            if aggregation not in {"sum", "mean", "count", "min", "max", "nunique"}:
                raise DecisionServiceError(
                    "set_aggregation requires sum, mean, count, min, max, or nunique."
                )
            normalized_arguments["aggregation"] = aggregation
        elif operation == "set_group_by":
            reference = str(
                arguments.get("dimension_id") or arguments.get("field") or arguments.get("dimension") or ""
            ).strip()
            if not reference:
                raise DecisionServiceError(
                    "set_group_by requires arguments.dimension_id, arguments.field, or arguments.dimension."
                )
        elif operation == "set_time_period":
            field = str(arguments.get("field") or arguments.get("dimension_id") or "").strip()
            start = str(arguments.get("start") or "").strip()
            end = str(arguments.get("end") or "").strip()
            if not field or not start or not end:
                raise DecisionServiceError("set_time_period requires arguments.field, arguments.start, and arguments.end.")
        elif operation == "set_output":
            output = str(arguments.get("output") or "").strip().lower()
            if output not in {"answer", "chart"}:
                raise DecisionServiceError("set_output requires arguments.output to be answer or chart.")
            normalized_arguments["output"] = output

        return {
            "schema_version": DecisionChatService.ANALYTICS_REFINEMENT_VERSION,
            "operation": operation,
            "arguments": normalized_arguments,
        }

    @staticmethod
    def _apply_refinement_to_filters(
        *,
        filters: List[Dict[str, Any]],
        analytics_refinement: Dict[str, Any] | None,
        semantic_model: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        operation = str((analytics_refinement or {}).get("operation") or "")
        arguments = (
            (analytics_refinement or {}).get("arguments")
            if isinstance((analytics_refinement or {}).get("arguments"), dict)
            else {}
        )
        updated = [dict(item) for item in filters if isinstance(item, dict)]
        if operation == "remove_filter":
            reference = arguments.get("field") or arguments.get("dimension_id")
            dimension = DecisionChatService._find_semantic_dimension_by_reference(reference, semantic_model)
            field = (dimension or {}).get("field") or reference
            updated = [item for item in updated if item.get("field") != field]
        elif operation == "set_time_period":
            reference = arguments.get("field") or arguments.get("dimension_id")
            dimension = DecisionChatService._find_semantic_dimension_by_reference(reference, semantic_model)
            field = (dimension or {}).get("field") or reference
            updated = [item for item in updated if item.get("field") != field]
            updated.extend([
                {"field": field, "operator": "gte", "value": arguments.get("start")},
                {"field": field, "operator": "lte", "value": arguments.get("end")},
            ])
        return updated

    @staticmethod
    def _find_semantic_metric_by_reference(
        reference: Any,
        semantic_model: Dict[str, Any] | None,
    ) -> Dict[str, Any] | None:
        normalized_reference = DecisionChatService._normalize_text(reference)
        for metric in (semantic_model or {}).get("metrics") or []:
            if not isinstance(metric, dict):
                continue
            candidates = (
                metric.get("id"), metric.get("name"), metric.get("label"), metric.get("field")
            )
            if normalized_reference and normalized_reference in {
                DecisionChatService._normalize_text(candidate) for candidate in candidates if candidate is not None
            }:
                return metric
        return None

    @staticmethod
    def _find_semantic_dimension_by_reference(
        reference: Any,
        semantic_model: Dict[str, Any] | None,
    ) -> Dict[str, Any] | None:
        normalized_reference = DecisionChatService._normalize_text(reference)
        for dimension in (semantic_model or {}).get("dimensions") or []:
            if not isinstance(dimension, dict):
                continue
            candidates = (
                dimension.get("id"), dimension.get("name"), dimension.get("label"), dimension.get("field")
            )
            if normalized_reference and normalized_reference in {
                DecisionChatService._normalize_text(candidate) for candidate in candidates if candidate is not None
            }:
                return dimension
        return None

    @staticmethod
    def _override_metric_aggregation(metric: Dict[str, Any], aggregation: str) -> Dict[str, Any]:
        """Create a request-local metric override without mutating the semantic model."""
        overridden = dict(metric)
        expression = dict(overridden.get("expression") or {})
        expression["aggregation"] = aggregation
        overridden["expression"] = expression
        overridden["default_aggregation"] = aggregation
        return overridden

    @staticmethod
    def _extract_time_period(
        filters: List[Dict[str, Any]],
        semantic_model: Dict[str, Any] | None,
    ) -> Dict[str, Any] | None:
        temporal_fields = {
            str(item.get("field"))
            for item in (semantic_model or {}).get("dimensions") or []
            if isinstance(item, dict)
            and item.get("field")
            and (
                str(item.get("semantic_kind") or "").lower() == "temporal"
                or str(item.get("data_type") or "").lower() in {"date", "datetime", "timestamp"}
            )
        }
        for field in temporal_fields:
            field_filters = [item for item in filters if isinstance(item, dict) and item.get("field") == field]
            if not field_filters:
                continue
            start = next((item.get("value") for item in field_filters if item.get("operator") in {"gte", "gt"}), None)
            end = next((item.get("value") for item in field_filters if item.get("operator") in {"lte", "lt"}), None)
            exact = next((item.get("value") for item in field_filters if item.get("operator") == "eq"), None)
            return {
                "field": field,
                "start": start or exact,
                "end": end or exact,
            }
        return None

    @staticmethod
    def _normalize_text(value: Any) -> str:
        return " ".join(str(value or "").strip().lower().replace("_", " ").split())

    @staticmethod
    def _normalize_reference_text(value: Any) -> str:
        """Normalize business references with conservative plural handling."""
        normalized = re.sub(
            r"[^a-z0-9]+",
            " ",
            DecisionChatService._normalize_text(value),
        ).strip()
        tokens: List[str] = []
        for token in normalized.split():
            if token.endswith("ies") and len(token) > 3:
                token = f"{token[:-3]}y"
            elif token.endswith("s") and len(token) > 3 and not token.endswith("ss"):
                token = token[:-1]
            tokens.append(token)
        return " ".join(tokens)

    @staticmethod
    def _find_semantic_reference(
        user_message: str,
        definitions: Any,
    ) -> Dict[str, Any] | None:
        """Select the longest grounded business reference, never a source alias alone."""
        normalized_query = DecisionChatService._normalize_reference_text(user_message)
        matches: List[Tuple[int, int, Dict[str, Any]]] = []
        for index, definition in enumerate(definitions or []):
            if not isinstance(definition, dict):
                continue
            candidates = [
                definition.get("label"),
                definition.get("display_name"),
                definition.get("source_field"),
                definition.get("qualified_label"),
                definition.get("name"),
                definition.get("field"),
                definition.get("id"),
                *(definition.get("aliases") or []),
            ]
            best_score = 0
            for candidate in candidates:
                normalized_candidate = DecisionChatService._normalize_reference_text(candidate)
                if not normalized_candidate:
                    continue
                if re.search(
                    rf"(?<!\w){re.escape(normalized_candidate)}(?!\w)",
                    normalized_query,
                ):
                    word_count = len(normalized_candidate.split())
                    best_score = max(
                        best_score,
                        word_count * 100 + len(normalized_candidate),
                    )
            if best_score:
                matches.append((best_score, -index, definition))
        if not matches:
            return None
        return sorted(matches, key=lambda item: (item[0], item[1]), reverse=True)[0][2]

    @staticmethod
    def _find_semantic_metric_reference(user_message: str, semantic_model: Dict[str, Any] | None) -> Dict[str, Any] | None:
        metrics = semantic_model.get("metrics") if isinstance(semantic_model, dict) else []
        return DecisionChatService._find_semantic_reference(user_message, metrics)

    @staticmethod
    def _find_semantic_dimension_reference(user_message: str, semantic_model: Dict[str, Any] | None) -> Dict[str, Any] | None:
        dimensions = semantic_model.get("dimensions") if isinstance(semantic_model, dict) else []
        return DecisionChatService._find_semantic_reference(user_message, dimensions)

    @staticmethod
    def _should_return_chart(user_message: str, analytic_state: Dict[str, Any]) -> bool:
        if is_visualization_request(user_message):
            return True
        return (
            analytic_state.get("output_preference") == "chart"
            and DecisionChatService._is_terse_analytic_follow_up(user_message)
        )

    @staticmethod
    def _is_terse_analytic_follow_up(user_message: str) -> bool:
        normalized = DecisionChatService._normalize_text(user_message)
        if not normalized:
            return False
        if any(phrase in normalized for phrase in ("what is", "what are", "how much", "how many", "total", "average")):
            return False
        tokens = normalized.split()
        return len(tokens) <= 5 or any(token in tokens for token in ("instead", "same", "again"))

    @staticmethod
    def _build_metric_chart_artifact(metric_result: Dict[str, Any]) -> Dict[str, Any]:
        chart_ready = metric_result.get("chart_ready") or {}
        metric_meta = metric_result.get("metric") or {}
        values = list(chart_ready.get("values") or [])
        labels = list(chart_ready.get("labels") or [])
        chart_type = "Line" if any("date" in str(label).lower() or "-" in str(label) for label in labels[:3]) else "Bar"
        group_by = list(metric_result.get("group_by") or [])
        filters_applied = metric_result.get("filters") or []
        metric_label = metric_meta.get("label") or metric_meta.get("name") or "Metric"
        group_label = (
            (group_by or [{}])[0].get("label")
            or (group_by or [{}])[0].get("name")
            or "Category"
        )
        title = f"{metric_label} chart"
        return {
            "type": "chart",
            "title": title,
            "content": {
                "chartType": chart_type,
                "chartData": {
                    "labels": labels,
                    "datasets": [{
                        "label": metric_label,
                        "data": values,
                    }],
                    "meta": {
                        "chartType": chart_type,
                        "axisLabels": {
                            "x": group_label,
                            "y": metric_label,
                        },
                    },
                },
                "fieldsUsed": {
                    "value": metric_meta.get("field") or metric_meta.get("label"),
                    "category": (group_by or [{}])[0].get("field") if group_by else None,
                },
                "filtersApplied": filters_applied,
                "meta": {
                    "type": chart_type,
                    "source": "semantic_metric",
                    "xLabel": group_label,
                    "yLabel": metric_label,
                },
                "result_context": DecisionChatService._build_metric_result_context(metric_result),
                "chartSpec": DecisionChatService._build_semantic_chart_spec(
                    title=title,
                    chart_type=chart_type,
                    metric=metric_meta,
                    group_by=group_by,
                    filters=filters_applied,
                    dataset=metric_result.get("dataset") or {},
                ),
            },
        }

    @staticmethod
    def _build_raw_chart_spec(
        *,
        title: str,
        chart_type: str,
        fields: Dict[str, Any],
        filters: List[Dict[str, Any]],
        meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Build a deterministic pin-ready chart spec for raw NLP charts."""
        normalized_filters = DecisionChatService._filters_to_slicers(filters, scope="local")
        return {
            "schemaVersion": "chart_spec_v1",
            "title": title,
            "chartType": chart_type,
            "sourceMode": "raw",
            "source": str(meta.get("source") or "chart_engine"),
            "rawMapping": {
                "x": fields.get("category") or fields.get("time"),
                "y": fields.get("value"),
                "time": fields.get("time"),
                "secondaryValue": fields.get("secondary_value"),
            },
            "semanticConfig": {
                "metricId": "",
                "groupBy": "",
            },
            "aggregation": "sum",
            "sortLimit": {
                "sort": "value_desc",
                "limit": meta.get("topN") if isinstance(meta.get("topN"), int) else None,
            },
            "slicers": normalized_filters,
            "inheritedSlicers": [],
            "pin": {
                "pinned": False,
                "sourceArtifact": "ai_chat",
            },
        }

    @staticmethod
    def _build_semantic_chart_spec(
        *,
        title: str,
        chart_type: str,
        metric: Dict[str, Any],
        group_by: List[Dict[str, Any]],
        filters: List[Dict[str, Any]],
        dataset: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Build a deterministic pin-ready chart spec for semantic metric charts."""
        primary_group = group_by[0] if group_by else {}
        return {
            "schemaVersion": "chart_spec_v1",
            "title": title,
            "chartType": chart_type,
            "sourceMode": "semantic",
            "source": "semantic_metric",
            "rawMapping": {
                "x": primary_group.get("field"),
                "y": metric.get("field"),
                "time": primary_group.get("field") if primary_group.get("semantic_kind") == "temporal" else None,
                "secondaryValue": None,
            },
            "semanticConfig": {
                "metricId": metric.get("id") or "",
                "metricName": metric.get("name") or metric.get("label") or "",
                "groupBy": primary_group.get("id") or primary_group.get("field") or "",
                "groupByField": primary_group.get("field") or "",
            },
            "aggregation": metric.get("default_aggregation") or (metric.get("expression") or {}).get("aggregation") or "sum",
            "sortLimit": {
                "sort": "value_desc" if group_by else None,
                "limit": None,
            },
            "slicers": DecisionChatService._filters_to_slicers(filters, scope="local"),
            "inheritedSlicers": [],
            "pin": {
                "pinned": False,
                "sourceArtifact": "ai_chat",
            },
            "dataset": {
                "datasetId": dataset.get("dataset_id"),
                "datasetName": dataset.get("dataset_name") or dataset.get("name"),
                "rowCount": dataset.get("row_count"),
                "sourceRowCount": dataset.get("source_row_count"),
            },
        }

    @staticmethod
    def _filters_to_slicers(filters: List[Dict[str, Any]], scope: str) -> List[Dict[str, Any]]:
        """Convert resolver filters into frontend slicer specs without guessing UI-only fields."""
        slicers: List[Dict[str, Any]] = []
        for index, filter_def in enumerate(filters or []):
            if not isinstance(filter_def, dict):
                continue
            field = filter_def.get("field") or filter_def.get("dimension_id") or filter_def.get("dimension")
            if not field:
                continue
            operator_name = str(filter_def.get("operator") or "eq").lower()
            values = filter_def.get("values")
            if values is None and filter_def.get("value") is not None:
                values = [filter_def.get("value")]
            slicers.append({
                "id": f"{scope}-slicer-{index + 1}-{field}",
                "scope": scope,
                "field": field,
                "label": filter_def.get("label") or field,
                "dimensionId": filter_def.get("dimension_id") or "",
                "kind": DecisionChatService._slicer_kind_for_operator(operator_name),
                "operator": operator_name,
                "value": filter_def.get("value"),
                "values": values if isinstance(values, list) else ([] if values is None else [values]),
                "applied": True,
            })
        return slicers

    @staticmethod
    def _slicer_kind_for_operator(operator_name: str) -> str:
        if operator_name in {"gte", "lte", "gt", "lt"}:
            return "range"
        if operator_name in {"contains", "starts_with", "ends_with"}:
            return "text"
        return "category"

    @staticmethod
    def _build_metric_answer_artifact(metric_result: Dict[str, Any]) -> Dict[str, Any]:
        metric_meta = metric_result.get("metric") or {}
        rows = list(metric_result.get("rows") or [])
        preview_rows = rows[:5]
        return {
            "type": "answer",
            "title": metric_meta.get("label") or metric_meta.get("name") or "Metric summary",
            "content": {
                "metric": metric_meta,
                "summary": metric_result.get("summary") or {},
                "rows": preview_rows,
                "group_by": metric_result.get("group_by") or [],
                "filters": metric_result.get("filters") or [],
                "result_context": DecisionChatService._build_metric_result_context(metric_result),
            },
        }

    @staticmethod
    def _build_metric_result_context(metric_result: Dict[str, Any]) -> Dict[str, Any]:
        dataset = metric_result.get("dataset") if isinstance(metric_result.get("dataset"), dict) else {}
        filtered_rows = int(dataset.get("row_count") or 0)
        source_rows = int(dataset.get("source_row_count") or filtered_rows)
        return {
            "schema_version": "di_conversational_result_context_v1",
            # Presentation metadata is additive; qualified fields remain in
            # each definition so readers and lineage consumers share one
            # artifact without conflating display labels with machine keys.
            "metric": dict(metric_result.get("metric") or {}),
            "group_by": [
                dict(item)
                for item in (metric_result.get("group_by") or [])
                if isinstance(item, dict)
            ],
            "evidence": {
                "metric_id": (metric_result.get("metric") or {}).get("id"),
                "group_by": [
                    item.get("field")
                    for item in (metric_result.get("group_by") or [])
                    if isinstance(item, dict) and item.get("field")
                ],
                "filters": list(metric_result.get("filters") or []),
                "filtered_row_count": filtered_rows,
                "source_row_count": source_rows,
            },
            "uncertainty": [
                "The result is a deterministic descriptive aggregation of the current grounded dataset.",
                "It does not establish causality, predict future outcomes, or provide a final recommendation.",
            ],
            "truth_boundary": "observational_analysis_only",
            "next_action": "Refine the metric, segment, period, or chart preference in the next turn.",
        }

    @staticmethod
    def _build_metric_summary_message(metric_result: Dict[str, Any]) -> str:
        metric_meta = metric_result.get("metric") or {}
        metric_label = metric_meta.get("label") or metric_meta.get("name") or "Metric"
        summary = metric_result.get("summary") or {}
        rows = list(metric_result.get("rows") or [])
        dataset = metric_result.get("dataset") if isinstance(metric_result.get("dataset"), dict) else {}
        filtered_rows = int(dataset.get("row_count") or 0)
        source_rows = int(dataset.get("source_row_count") or filtered_rows)
        evidence_note = (
            f" Based on {filtered_rows} of {source_rows} grounded rows; this is descriptive, observational evidence."
        )
        summary_value = DecisionChatService._format_value(summary.get("value"), metric_meta.get("format_hint"))
        if not rows or len(rows) == 1 and not rows[0].get("group"):
            return f"{metric_label} is {summary_value} for the current grounded context.{evidence_note}"

        top_row = rows[0]
        top_group = DecisionChatService._format_group_label(
            top_row.get("group") or {},
            metric_result.get("group_by") or [],
        )
        top_value = DecisionChatService._format_value(top_row.get("value"), metric_meta.get("format_hint"))
        return f"{metric_label} totals {summary_value}. The top result is {top_group} at {top_value}.{evidence_note}"

    @staticmethod
    def _build_raw_summary(
        dataset: List[Dict[str, Any]],
        fields: Dict[str, Any],
        user_message: str,
    ) -> Dict[str, Any] | None:
        value_field = fields.get("value")
        category_field = fields.get("category")
        time_field = fields.get("time")
        if not value_field:
            return None

        aggregation = DecisionChatService._detect_aggregation_from_query(user_message)

        # When a grouping field exists, summarize the same deterministic aggregation that charting would use.
        if category_field or time_field:
            chart_response = DecisionChatService._build_grounded_chart_response(
                dataset,
                {
                    "chart_type": "Line" if time_field else "Bar",
                    "fields": fields,
                },
                aggregation=aggregation,
            )
            chart_data = chart_response.get("chartData") or {}
            labels = list(chart_data.get("labels") or [])
            values = list(((chart_data.get("datasets") or [{}])[0]).get("data") or [])
            if not labels or not values:
                return None
            top_index = max(range(len(values)), key=lambda index: float(values[index] or 0))
            total_value = sum(float(value or 0) for value in values)
            top_label = labels[top_index]
            top_value = values[top_index]
            return {
                "assistant_message": (
                    f"{aggregation.title()} {value_field} is {DecisionChatService._format_value(total_value)} "
                    f"across the grounded groups. The top result is {top_label} at {DecisionChatService._format_value(top_value)}."
                ),
                "artifact": {
                    "type": "answer",
                    "title": f"{value_field} summary",
                    "content": {
                        "fieldsUsed": {key: value for key, value in fields.items() if value},
                        "aggregation": aggregation,
                        "top_group": {"label": top_label, "value": top_value},
                        "group_count": len(labels),
                    },
                },
            }

        numeric_values = []
        for row in dataset:
            raw_value = row.get(value_field)
            try:
                numeric = float(raw_value)
            except (TypeError, ValueError):
                continue
            numeric_values.append(numeric)

        if not numeric_values:
            return None

        if aggregation == "mean":
            result_value = sum(numeric_values) / len(numeric_values)
        elif aggregation == "count":
            result_value = len(numeric_values)
        elif aggregation == "min":
            result_value = min(numeric_values)
        elif aggregation == "max":
            result_value = max(numeric_values)
        else:
            result_value = sum(numeric_values)

        return {
            "assistant_message": f"{aggregation.title()} {value_field} is {DecisionChatService._format_value(result_value)} for the current grounded dataset.",
            "artifact": {
                "type": "answer",
                "title": f"{value_field} summary",
                "content": {
                    "fieldsUsed": {key: value for key, value in fields.items() if value},
                    "aggregation": aggregation,
                    "value": result_value,
                    "row_count": len(numeric_values),
                },
            },
        }

    @staticmethod
    def _detect_aggregation_from_query(user_message: str) -> str:
        lowered = str(user_message or "").strip().lower()
        if any(keyword in lowered for keyword in ("average", "avg", "mean")):
            return "mean"
        if "count" in lowered:
            return "count"
        if "min" in lowered or "minimum" in lowered or "lowest" in lowered:
            return "min"
        if "max" in lowered or "maximum" in lowered or "highest" in lowered or "top" in lowered:
            return "max"
        return "sum"

    @staticmethod
    def _format_group_label(
        group_values: Dict[str, Any],
        group_defs: List[Dict[str, Any]] | None = None,
    ) -> str:
        if not group_values:
            return "All Data"
        if len(group_values) == 1:
            return str(next(iter(group_values.values())))
        labels_by_field = {
            definition.get("field"): definition.get("label") or definition.get("name")
            for definition in (group_defs or [])
            if isinstance(definition, dict) and definition.get("field")
        }
        return " | ".join(
            f"{labels_by_field.get(field) or DecisionChatService._display_field_label(field)}: {value}"
            for field, value in group_values.items()
        )

    @staticmethod
    def _format_value(value: Any, format_hint: str | None = None) -> str:
        if value is None:
            return "no value"
        try:
            decimal_value = Decimal(str(value))
        except (InvalidOperation, ValueError):
            return str(value)
        if format_hint == "percentage":
            return f"{decimal_value * Decimal('100'):.2f}%"
        if format_hint == "currency":
            return f"${decimal_value:,.2f}"
        if decimal_value == decimal_value.to_integral():
            return f"{int(decimal_value):,}"
        return f"{decimal_value:,.2f}"

    @staticmethod
    def _build_grounded_reply(user_message: str, grounding_summary: Dict[str, Any]) -> Tuple[str, List[str]]:
        dataset_summary = grounding_summary.get("dataset") or {}
        semantic_summary = grounding_summary.get("semantic_model") or {}
        row_count = int(dataset_summary.get("row_count") or 0)
        column_count = int(dataset_summary.get("column_count") or 0)
        metric_count = int(semantic_summary.get("metric_count") or 0)
        dimension_count = int(semantic_summary.get("dimension_count") or 0)

        if row_count <= 0:
            return (
                "I can help frame a decision, but I need an active dataset before I can ground analytics or draft a workspace from real business context.",
                ["No active dataset was provided for this turn."],
            )

        return (
            f"I am grounded in {row_count} rows across {column_count} columns"
            f" with {metric_count} semantic metrics and {dimension_count} semantic dimensions available. "
            "Ask for a chart, compare a segment, or frame a business decision in plain English.",
            [],
        )

    @staticmethod
    def _decision_truthfulness_note() -> str:
        return (
            "This is grounded decision support, not a recommendation, simulation, optimizer, "
            "or final decision."
        )

    @staticmethod
    def _normalize_analysis_summary(summary: Any) -> Dict[str, Any]:
        if isinstance(summary, dict):
            headline = str(summary.get("headline") or summary.get("summary") or "").strip()
            return {
                "headline": headline,
                "details": summary,
            }
        summary_text = str(summary or "").strip()
        return {
            "headline": summary_text,
            "details": {"text": summary_text} if summary_text else {},
        }

    @staticmethod
    def _build_action_summary_artifact(
        *,
        action_id: str,
        title: str,
        workspace: Dict[str, Any],
        content: Dict[str, Any],
    ) -> Dict[str, Any]:
        readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else {}
        base_content = {
            "action_id": action_id,
            "response_kind": action_id,
            "workspace_id": workspace.get("workspace_id"),
            "workspace_status": workspace.get("status"),
            "readiness_state": readiness.get("readiness_state"),
            "structural_readiness": readiness.get("structural_readiness") or {},
            "blocked_state": readiness.get("blocked_state") or {},
            "allowed_next_actions": list(readiness.get("allowed_next_actions") or []),
            "capability_state": readiness.get("capability_state") or {},
            "missing_inputs": list(readiness.get("missing_inputs") or []),
            "truthfulness_note": DecisionChatService._decision_truthfulness_note(),
        }
        base_content.update(content if isinstance(content, dict) else {})
        return {
            "type": "workspace_analysis_summary",
            "title": title,
            "action_id": action_id,
            "response_kind": action_id,
            "content": base_content,
        }

    @staticmethod
    def _build_workspace_preview(workspace: Dict[str, Any]) -> Dict[str, Any]:
        decision_scope = workspace.get("decision_scope") if isinstance(workspace.get("decision_scope"), dict) else {}
        readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else {}
        objective = decision_scope.get("objective") if isinstance(decision_scope.get("objective"), dict) else {}
        levers = decision_scope.get("levers") if isinstance(decision_scope.get("levers"), list) else []
        segment_dimensions = (
            decision_scope.get("segment_dimensions")
            if isinstance(decision_scope.get("segment_dimensions"), list)
            else []
        )
        constraints = decision_scope.get("constraints") if isinstance(decision_scope.get("constraints"), list) else []
        missing_inputs = list(readiness.get("missing_inputs") or [])
        prompt_frame = (workspace.get("drafting") or {}).get("prompt_frame") if isinstance(workspace.get("drafting"), dict) else {}
        prompt_frame = prompt_frame if isinstance(prompt_frame, dict) else {}
        objective_metric = (objective.get("metric_ref") or {}).get("label") or objective.get("metric_id")
        time_horizon = objective.get("time_horizon") if isinstance(objective.get("time_horizon"), dict) else {}
        lever_items = DecisionChatService._build_preview_lever_items(levers)
        segment_items = DecisionChatService._build_preview_segment_items(segment_dimensions, levers)
        guardrail_items = DecisionChatService._build_preview_guardrail_items(constraints)
        status = str(workspace.get("status") or "").strip().lower()
        recommended_next_action = DecisionChatService._build_preview_next_action(
            status=status,
            missing_inputs=missing_inputs,
        )
        readiness_meaning = DecisionChatService._build_preview_readiness_meaning(
            status=status,
            missing_inputs=missing_inputs,
        )
        truthfulness_note = (
            DecisionChatService._decision_truthfulness_note()
            + " Analysis can inspect grounded data, but it will not choose for you."
        )

        return {
            "type": "workspace_preview",
            "workspace_id": workspace.get("workspace_id"),
            "title": workspace.get("title"),
            "status": workspace.get("status"),
            "status_label": DecisionChatService._build_preview_status_label(status),
            "scope_summary": workspace.get("scope_summary"),
            # Keep this explicit so the frontend can render a human-readable kickoff
            # without reverse-engineering the raw workspace contract.
            "decision_kickoff": {
                "summary": DecisionChatService._build_preview_kickoff_summary(
                    objective=objective,
                    objective_metric=objective_metric,
                    time_horizon=time_horizon,
                    lever_items=lever_items,
                    segment_items=segment_items,
                    guardrail_items=guardrail_items,
                ),
                "understood": {
                    "objective": {
                        "statement": objective.get("statement"),
                        "metric": objective_metric,
                        "direction": objective.get("direction"),
                        "time_horizon": time_horizon.get("label"),
                    },
                    "levers": lever_items,
                    "segments": segment_items,
                    "guardrails": guardrail_items,
                },
                "readiness_meaning": readiness_meaning,
                "truthfulness_note": truthfulness_note,
                "recommended_next_action": recommended_next_action,
                "readiness_state": readiness.get("readiness_state"),
                "capability_state": readiness.get("capability_state") or {},
            },
            "readiness_state": readiness.get("readiness_state"),
            "truth_boundary": readiness.get("truth_boundary") or "observational_analysis_only",
            "structural_readiness": readiness.get("structural_readiness") or {},
            "blocked_state": readiness.get("blocked_state") or {},
            "allowed_next_actions": list(readiness.get("allowed_next_actions") or []),
            "capability_state": readiness.get("capability_state") or {},
            "unsupported_capabilities": list(readiness.get("unsupported_capabilities") or []),
            "not_ready_for_recommendation": bool(readiness.get("not_ready_for_recommendation", True)),
            "objective_metric": objective_metric,
            "time_horizon": time_horizon.get("label"),
            "levers": lever_items,
            "segment_dimensions": segment_items,
            "guardrails": guardrail_items,
            "readiness_meaning": readiness_meaning,
            "truthfulness_note": truthfulness_note,
            "recommended_next_action": recommended_next_action,
            "prompt_frame": {
                "objective_clause": prompt_frame.get("objective_clause"),
                "lever_clause": prompt_frame.get("lever_clause"),
                "segment_clause": prompt_frame.get("segment_clause"),
                "constraint_clauses": list(prompt_frame.get("constraint_clauses") or []),
            },
            "objective": {
                "statement": objective.get("statement"),
                "direction": objective.get("direction"),
                "metric": objective_metric,
            },
            "lever_count": len(levers),
            "constraint_count": len(constraints),
            "missing_inputs": missing_inputs,
            "clarification_hints": list(((workspace.get("drafting") or {}).get("clarification_hints")) or []),
            "unknown_count": len(workspace.get("unknowns") or []),
        }

    @staticmethod
    def _build_workspace_preview_message(workspace: Dict[str, Any]) -> str:
        preview = DecisionChatService._build_workspace_preview(workspace)
        missing_inputs = preview.get("missing_inputs") or []
        clarification_hints = preview.get("clarification_hints") or []
        kickoff = preview.get("decision_kickoff") or {}
        summary = kickoff.get("summary") or "I drafted a decision workspace from your prompt."
        readiness_meaning = preview.get("readiness_meaning") or ""
        truthfulness_note = preview.get("truthfulness_note") or ""
        next_action = preview.get("recommended_next_action") or {}
        if missing_inputs:
            clarification = f" Next question: {clarification_hints[0]}" if clarification_hints else ""
            return (
                f"{summary} {readiness_meaning} "
                f"It still needs {len(missing_inputs)} input(s) before structured analysis is reliable."
                f"{clarification}"
            )
        next_label = next_action.get("label") or "Analyze workspace"
        return f"{summary} {readiness_meaning} {truthfulness_note} Available next check: {next_label}."

    @staticmethod
    def _build_preview_lever_items(levers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        for lever in levers:
            if not isinstance(lever, dict):
                continue
            binding = lever.get("binding") if isinstance(lever.get("binding"), dict) else {}
            metric_ref = binding.get("metric_ref") if isinstance(binding.get("metric_ref"), dict) else {}
            dimension_ref = binding.get("dimension_ref") if isinstance(binding.get("dimension_ref"), dict) else {}
            binding_label = (
                metric_ref.get("label")
                or dimension_ref.get("label")
                or binding.get("field")
                or binding.get("metric_id")
                or binding.get("dimension_id")
            )
            items.append({
                "label": lever.get("label"),
                "type": lever.get("lever_type"),
                "binding_label": binding_label,
                "desired_change": lever.get("desired_change"),
                "controllable": bool(lever.get("controllable", True)),
            })
        return items

    @staticmethod
    def _build_preview_segment_items(
        segment_dimensions: List[Dict[str, Any]],
        levers: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        segments: List[Dict[str, Any]] = []
        for segment in segment_dimensions:
            if not isinstance(segment, dict):
                continue
            binding = segment.get("binding") if isinstance(segment.get("binding"), dict) else {}
            dimension_ref = binding.get("dimension_ref") if isinstance(binding.get("dimension_ref"), dict) else {}
            if not dimension_ref:
                continue
            segments.append({
                "label": dimension_ref.get("label") or segment.get("label"),
                "dimension_id": dimension_ref.get("dimension_id"),
                "role": "segment",
            })
        if segments:
            return segments

        for lever in levers or []:
            if not isinstance(lever, dict):
                continue
            binding = lever.get("binding") if isinstance(lever.get("binding"), dict) else {}
            dimension_ref = binding.get("dimension_ref") if isinstance(binding.get("dimension_ref"), dict) else {}
            if not dimension_ref:
                continue
            segments.append({
                "label": dimension_ref.get("label") or lever.get("label"),
                "dimension_id": dimension_ref.get("dimension_id"),
                "role": "segment",
            })
        return segments

    @staticmethod
    def _build_preview_guardrail_items(constraints: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        guardrails: List[Dict[str, Any]] = []
        for constraint in constraints:
            if not isinstance(constraint, dict):
                continue
            binding = constraint.get("binding") if isinstance(constraint.get("binding"), dict) else {}
            metric_ref = binding.get("metric_ref") if isinstance(binding.get("metric_ref"), dict) else {}
            guardrails.append({
                "label": constraint.get("label"),
                "metric": metric_ref.get("label") or binding.get("metric_id"),
                "hardness": constraint.get("hardness"),
                "condition": constraint.get("condition"),
            })
        return guardrails

    @staticmethod
    def _build_preview_status_label(status: str) -> str:
        if status == "ready":
            return "Structurally ready for analysis"
        if status == "limited":
            return "Partially framed; analysis will be limited"
        if status == "needs_input":
            return "Needs more decision input"
        return "Draft workspace"

    @staticmethod
    def _build_preview_readiness_meaning(status: str, missing_inputs: List[str]) -> str:
        if status == "ready" and not missing_inputs:
            return (
                "Ready means the objective, at least one controllable lever, and hard guardrails "
                "are structured enough for observational workspace analysis."
            )
        if missing_inputs:
            return (
                "This draft is not analysis-ready yet because key decision inputs are still missing."
            )
        return "This draft can be inspected, but some bindings or assumptions may limit analysis quality."

    @staticmethod
    def _build_preview_next_action(status: str, missing_inputs: List[str]) -> Dict[str, Any]:
        if status == "ready" and not missing_inputs:
            return {
                "action_id": "analyze_workspace",
                "label": "Analyze workspace",
                "reason": "Run grounded observational analysis before treating the frame as decision evidence.",
            }
        return {
            "action_id": "show_blockers",
            "label": "Show blockers",
            "reason": "Review the missing inputs that prevent a clean analysis pass.",
        }

    @staticmethod
    def _build_preview_kickoff_summary(
        *,
        objective: Dict[str, Any],
        objective_metric: Any,
        time_horizon: Dict[str, Any],
        lever_items: List[Dict[str, Any]],
        segment_items: List[Dict[str, Any]],
        guardrail_items: List[Dict[str, Any]],
    ) -> str:
        objective_label = objective_metric or objective.get("statement") or "the stated objective"
        direction = str(objective.get("direction") or "improve").replace("_", " ")
        horizon_label = time_horizon.get("label")
        lever_labels = [str(item.get("label")) for item in lever_items if item.get("label")]
        segment_labels = [str(item.get("label")) for item in segment_items if item.get("label")]
        guardrail_labels = [str(item.get("metric") or item.get("label")) for item in guardrail_items if item.get("metric") or item.get("label")]

        sentence = f"I understood this as a decision about whether and how to {direction} {objective_label}"
        if horizon_label:
            sentence += f" over {horizon_label}"
        if lever_labels:
            sentence += f" using {DecisionChatService._join_preview_labels(lever_labels)}"
        if segment_labels:
            sentence += f", with the analysis segmented by {DecisionChatService._join_preview_labels(segment_labels)}"
        if guardrail_labels:
            sentence += f", while protecting {DecisionChatService._join_preview_labels(guardrail_labels)}"
        return sentence + "."

    @staticmethod
    def _join_preview_labels(labels: List[str]) -> str:
        cleaned = [label for label in labels if label]
        if not cleaned:
            return ""
        if len(cleaned) == 1:
            return cleaned[0]
        return f"{', '.join(cleaned[:-1])} and {cleaned[-1]}"

    @staticmethod
    def _build_decision_actions(workspace: Dict[str, Any] | None) -> List[Dict[str, Any]]:
        if not isinstance(workspace, dict) or not workspace:
            return []
        missing_inputs = list((workspace.get("readiness") or {}).get("missing_inputs") or [])
        blockers = [
            item for item in (workspace.get("unknowns") or [])
            if isinstance(item, dict) and item.get("blocks_simulation")
        ]
        status = str(workspace.get("status") or "").strip().lower()
        has_assumptions = bool(workspace.get("assumptions"))
        can_analyze = status == "ready" and not missing_inputs
        primary_action = "show_blockers" if missing_inputs else "analyze_workspace"
        return [
            DecisionChatService._build_action(
                action_id="draft_workspace",
                mode="decide",
                priority="secondary",
                availability_reason="A draft can be refreshed from the current decision prompt.",
            ),
            DecisionChatService._build_action(
                action_id="show_assumptions",
                mode="decide",
                priority="secondary",
                enabled=has_assumptions,
                availability_reason=(
                    f"{len(workspace.get('assumptions') or [])} assumption(s) are attached to this draft."
                    if has_assumptions
                    else "No explicit assumptions are attached to this draft yet."
                ),
            ),
            DecisionChatService._build_action(
                action_id="show_blockers",
                mode="decide",
                priority="primary" if primary_action == "show_blockers" else "secondary",
                enabled=bool(missing_inputs or blockers),
                availability_reason=(
                    f"{len(missing_inputs)} missing input(s) are currently tracked."
                    if missing_inputs
                    else (
                        f"{len(blockers)} blocking gap(s) are currently tracked."
                        if blockers
                        else "No explicit missing inputs or blocking gaps are currently tracked."
                    )
                ),
            ),
            DecisionChatService._build_action(
                action_id="analyze_workspace",
                mode="decide",
                priority="primary" if primary_action == "analyze_workspace" else "secondary",
                enabled=can_analyze,
                availability_reason=(
                    "The draft is structurally ready for grounded observational analysis."
                    if can_analyze
                    else "Analysis is disabled until the objective, lever, and guardrail structure is ready."
                ),
            ),
            DecisionChatService._build_action(
                action_id="open_workspace",
                mode="decide",
                priority="secondary",
                availability_reason="A structured decision output is available for in-chat review.",
            ),
        ]
