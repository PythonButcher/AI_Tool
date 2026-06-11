"""Phase 4 chat orchestration for Decision Intelligence."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

from backend.decision_engine.grounding import build_grounding_summary
from backend.decision_engine.mode_detection import detect_chat_mode_details, is_visualization_request
from backend.services.aichat_nlp import analyse_columns, build_chart_response, extract_dataset, interpret_nl_query
from backend.services.decision_output_service import DecisionOutputService
from backend.services.decision_support import DecisionServiceError, build_dataset_trust
from backend.services.metric_resolver import MetricResolutionError, MetricResolver
from backend.services.decision_workspace_service import DecisionWorkspaceService


class DecisionChatService:
    """
    First Phase 4 backend slice for chat-first Decision Intelligence.

    The service keeps the contract stable and grounded while we build out the
    larger decision engine package behind it.
    """

    CONTRACT_VERSION = "di_v3_phase4_5_chat_v1"
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
            "label": "Open workspace",
            "intent": "open_decisions_workspace",
            "description": "Open the structured Decisions workspace and continue from this draft.",
            "payload_expectations": {
                "required": ["session_state.draft_workspace"],
                "optional": ["decision_workspace"],
                "produces": ["workspace_preview", "workspace_handoff"],
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
    def handle_turn(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        user_message = str(payload.get("user_message") or "").strip()
        if not user_message:
            raise DecisionServiceError("user_message is required for decision chat turns.")

        dataset = extract_dataset(payload.get("dataset"))
        semantic_model = payload.get("semantic_model") or payload.get("semanticModel")
        session_state = DecisionChatService._normalize_session_state(payload.get("session_state"))
        grounding_summary = build_grounding_summary(dataset, semantic_model)
        mode_details = detect_chat_mode_details(user_message, session_state)
        mode = mode_details["mode"]
        if (
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
        warnings: List[str] = []
        assistant_message = ""
        draft_workspace = DecisionChatService._extract_workspace(payload, session_state)
        workspace_analysis: Dict[str, Any] | None = None
        output_correction_result: Dict[str, Any] | None = None
        available_actions: List[Dict[str, Any]] = []
        analytic_state = DecisionChatService._normalize_analytic_state(session_state.get("last_analytic_context"))

        # Explore mode now supports grounded analytics answers and stateful follow-up turns.
        if mode == "explore" and dataset:
            analytics_result = DecisionChatService._build_analytics_response(
                user_message=user_message,
                dataset=dataset,
                semantic_model=semantic_model,
                session_state=session_state,
            )
            if analytics_result is not None:
                assistant_message = analytics_result["assistant_message"]
                artifacts.extend(analytics_result["artifacts"])
                available_actions = list(analytics_result.get("suggested_actions") or [])
                analytic_state = analytics_result.get("analytic_state") or analytic_state
            elif is_visualization_request(user_message):
                chart_artifact, assistant_message = DecisionChatService._build_chart_artifact(user_message, dataset)
                artifacts.append(chart_artifact)
                analytic_state = {
                    "source": "raw_nlp",
                    "fields": dict((chart_artifact.get("content") or {}).get("fieldsUsed") or {}),
                    "output_preference": "chart",
                    "last_user_message": user_message,
                }
            else:
                assistant_message, warnings = DecisionChatService._build_grounded_reply(user_message, grounding_summary)
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
            if text_action and draft_workspace is not None:
                action_result = DecisionChatService._execute_decision_action(
                    action=text_action,
                    payload=payload,
                    session_state=session_state,
                    workspace=draft_workspace,
                    user_message=user_message,
                )
                artifacts.extend(action_result["artifacts"])
                assistant_message = action_result["assistant_message"]
                warnings = list(action_result.get("warnings") or [])
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
            elif DecisionChatService._should_rebuild_decision_workspace(
                payload=payload,
                session_state=session_state,
                user_message=user_message,
                mode_details=mode_details,
                draft_workspace=draft_workspace,
            ):
                draft_workspace = DecisionChatService._create_draft_workspace(payload, user_message)
            elif draft_workspace is None:
                draft_workspace = DecisionChatService._create_draft_workspace(payload, user_message)
            if draft_workspace is not None and not artifacts:
                preview = DecisionChatService._build_workspace_preview(draft_workspace)
                artifacts.append(preview)
                assistant_message = DecisionChatService._build_workspace_preview_message(draft_workspace)
            available_actions = DecisionChatService._build_decision_actions(draft_workspace)

        else:
            assistant_message, warnings = DecisionChatService._build_grounded_reply(user_message, grounding_summary)
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
            workspace=draft_workspace,
            dataset_trust=dataset_trust,
            workspace_analysis=workspace_analysis,
            correction_result=output_correction_result,
            scenario_preview=scenario_preview,
        )
        if decision_output is not None:
            artifacts.append(decision_output)
        normalized_actions = DecisionChatService._normalize_available_actions(available_actions, mode=mode)
        normalized_artifacts = DecisionChatService._attach_dataset_trust(
            DecisionChatService._annotate_artifacts(artifacts, mode=mode),
            dataset_trust,
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
            "contract_version": DecisionChatService.CONTRACT_VERSION,
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
            "dataset_trust": dataset_trust,
            "session_state": updated_state,
            "grounding_summary": grounding_summary,
            "warnings": warnings,
        }

    @staticmethod
    def handle_action(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        action = str(payload.get("action") or payload.get("action_id") or "").strip().lower()
        if not action:
            raise DecisionServiceError("action is required for decision chat actions.")
        if action not in DecisionChatService.DECISION_ACTION_CONTRACTS:
            raise DecisionServiceError(f"Unsupported decision chat action: {action}")

        session_state = DecisionChatService._normalize_session_state(payload.get("session_state"))
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
        )
        if decision_output is not None:
            artifacts.append(decision_output)
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
            "correction_result": correction_result,
            "trace": correction_trace,
            "dataset_trust": dataset_trust,
            "session_state": updated_state,
            "warnings": warnings,
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
    ) -> Dict[str, Any]:
        previous_mode = str(session_state.get("active_mode") or "").strip().lower() or None
        preserved_state = dict(session_state)
        active_decision_prompt = ""
        if isinstance(draft_workspace, dict):
            active_decision_prompt = str(draft_workspace.get("decision_prompt") or "").strip()
        updated_state = {
            **preserved_state,
            "schema_version": "di_phase4_5_session_state_v1",
            "active_mode": mode,
            "decision_prompt": active_decision_prompt or preserved_state.get("decision_prompt") or user_message,
        }

        if analytic_state:
            updated_state["last_analytic_context"] = analytic_state
            updated_state["analytics_state"] = analytic_state

        if draft_workspace is not None:
            updated_state["draft_workspace"] = draft_workspace
        elif "draft_workspace" in updated_state:
            updated_state["draft_workspace"] = updated_state.get("draft_workspace")

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
        return {
            "current_mode": mode,
            "current_mode_label": DecisionChatService._mode_label(mode),
            "previous_mode": previous_mode,
            "mode_changed": bool(previous_mode and previous_mode != mode),
            "reason_code": str(mode_details.get("reason_code") or "unspecified"),
            "reason": str(mode_details.get("reason") or "").strip(),
            "available_modes": [
                {"mode": "ask", "label": "Ask"},
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
        label = str(raw_action.get("label") or contract.get("label") or action_id.replace("_", " ").title()).strip()
        description = str(raw_action.get("description") or contract.get("description") or "").strip() or None
        intent = str(raw_action.get("intent") or contract.get("intent") or action_id).strip().lower()
        priority = str(raw_action.get("priority") or "secondary").strip().lower() or "secondary"
        if priority not in {"primary", "secondary", "informational"}:
            priority = "secondary"
        payload_expectations = raw_action.get("payload_expectations")
        if not isinstance(payload_expectations, dict):
            payload_expectations = contract.get("payload_expectations") if isinstance(contract.get("payload_expectations"), dict) else {}
        return {
            "action_id": action_id,
            "label": label,
            "intent": intent,
            "description": description,
            "mode": str(raw_action.get("mode") or mode).strip().lower() or mode,
            "kind": str(raw_action.get("kind") or "decision_tool").strip().lower() or "decision_tool",
            "priority": priority,
            "enabled": bool(raw_action.get("enabled", True)),
            "availability_reason": str(raw_action.get("availability_reason") or "").strip() or None,
            "payload_expectations": dict(payload_expectations),
        }

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
            "payload_expectations": (
                payload_expectations
                if isinstance(payload_expectations, dict)
                else dict(contract.get("payload_expectations") or {})
            ),
        }

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
        )

    @staticmethod
    def _mode_label(mode: str) -> str:
        labels = {
            "ask": "Ask",
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
    def _should_rebuild_decision_workspace(
        *,
        payload: Dict[str, Any],
        session_state: Dict[str, Any],
        user_message: str,
        mode_details: Dict[str, Any],
        draft_workspace: Dict[str, Any] | None,
    ) -> bool:
        """Detect when a new decision question should replace stale chat draft state."""
        if (mode_details or {}).get("reason_code") != "decision_request":
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
                raise DecisionServiceError("A draft workspace is required before it can be opened.")
            preview = DecisionChatService._build_workspace_preview(workspace)
            artifacts.append({
                **preview,
                "title": "Open workspace handoff",
                "action_id": action,
                "response_kind": action,
                "handoff": {
                    "target": "decisions",
                    "workspace_id": workspace.get("workspace_id"),
                    "workspace_status": workspace.get("status"),
                },
            })
            assistant_message = "Open this draft in the Decisions destination to continue structured work."

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
        chart_response = build_chart_response(dataset, interpretation)
        fields_used = {key: value for key, value in (interpretation.get("fields") or {}).items() if value}
        chart_type = chart_response.get("chartType") or interpretation.get("chart_type") or "Bar"
        explanation = chart_response.get("explanation") or f"Generated a {chart_type.lower()} chart from the grounded dataset."

        return {
            "type": "chart",
            "title": f"{chart_type} chart",
            "content": {
                "chartType": chart_type,
                "chartData": chart_response.get("chartData"),
                "fieldsUsed": fields_used,
                "filtersApplied": interpretation.get("filters") or [],
                "meta": chart_response.get("meta") or {},
            },
        }, explanation

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
        )
        if semantic_response is not None:
            return semantic_response

        raw_response = DecisionChatService._build_raw_analytics_response(
            user_message=user_message,
            dataset=dataset,
            analytic_state=analytic_state,
        )
        return raw_response

    @staticmethod
    def _build_semantic_metric_response(
        user_message: str,
        dataset: List[Dict[str, Any]],
        semantic_model: Dict[str, Any] | None,
        analytic_state: Dict[str, Any],
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

        prefer_chart = DecisionChatService._should_return_chart(user_message, analytic_state)
        group_by = [dimension_ref.get("id") or dimension_ref.get("field")] if isinstance(dimension_ref, dict) and (dimension_ref.get("id") or dimension_ref.get("field")) else []

        try:
            metric_result = MetricResolver.resolve(
                metric_id=metric_ref.get("id"),
                metric_name=metric_ref.get("label") or metric_ref.get("name"),
                dataset=dataset,
                semantic_model=semantic_model,
                group_by=group_by,
                limit=8 if prefer_chart else 5,
                sort="value_desc" if group_by else None,
            )
        except MetricResolutionError:
            return None

        if prefer_chart and metric_result.get("group_by"):
            artifact = DecisionChatService._build_metric_chart_artifact(metric_result)
        else:
            artifact = DecisionChatService._build_metric_answer_artifact(metric_result)

        return {
            "assistant_message": DecisionChatService._build_metric_summary_message(metric_result),
            "artifacts": [artifact],
            "analytic_state": {
                "source": "semantic_metric",
                "metric_id": (metric_result.get("metric") or {}).get("id"),
                "metric_name": (metric_result.get("metric") or {}).get("label") or (metric_result.get("metric") or {}).get("name"),
                "group_by": [item.get("field") for item in (metric_result.get("group_by") or []) if item.get("field")],
                "output_preference": "chart" if artifact.get("type") == "chart" else "answer",
                "last_user_message": user_message,
            },
            "suggested_actions": [],
        }

    @staticmethod
    def _build_raw_analytics_response(
        user_message: str,
        dataset: List[Dict[str, Any]],
        analytic_state: Dict[str, Any],
    ) -> Dict[str, Any] | None:
        columns = analyse_columns(dataset)
        interpretation = interpret_nl_query(user_message, columns)
        merged_fields = DecisionChatService._merge_raw_fields(
            current_fields=interpretation.get("fields") or {},
            analytic_state=analytic_state,
        )
        if not any(merged_fields.values()):
            return None

        prefer_chart = DecisionChatService._should_return_chart(user_message, analytic_state)
        if prefer_chart:
            chart_response = build_chart_response(
                dataset,
                {
                    **interpretation,
                    "fields": merged_fields,
                },
            )
            chart_data = chart_response.get("chartData") or {}
            if chart_data.get("datasets"):
                chart_type = chart_response.get("chartType") or interpretation.get("chart_type") or "Bar"
                artifact = {
                    "type": "chart",
                    "title": f"{chart_type} chart",
                    "content": {
                        "chartType": chart_type,
                        "chartData": chart_data,
                        "fieldsUsed": {key: value for key, value in merged_fields.items() if value},
                        "filtersApplied": interpretation.get("filters") or [],
                        "meta": chart_response.get("meta") or {},
                    },
                }
                return {
                    "assistant_message": f"Generated a {chart_type.lower()} chart from the grounded dataset.",
                    "artifacts": [artifact],
                    "analytic_state": {
                        "source": "raw_nlp",
                        "fields": {key: value for key, value in merged_fields.items() if value},
                        "output_preference": "chart",
                        "last_user_message": user_message,
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
                "source": "raw_nlp",
                "fields": {key: value for key, value in merged_fields.items() if value},
                "output_preference": "answer",
                "last_user_message": user_message,
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
    def _normalize_analytic_state(analytic_state: Any) -> Dict[str, Any]:
        return analytic_state if isinstance(analytic_state, dict) else {}

    @staticmethod
    def _normalize_text(value: Any) -> str:
        return " ".join(str(value or "").strip().lower().replace("_", " ").split())

    @staticmethod
    def _find_semantic_metric_reference(user_message: str, semantic_model: Dict[str, Any] | None) -> Dict[str, Any] | None:
        metrics = semantic_model.get("metrics") if isinstance(semantic_model, dict) else []
        normalized_query = DecisionChatService._normalize_text(user_message)
        matches: List[Tuple[int, Dict[str, Any]]] = []
        for metric in metrics or []:
            if not isinstance(metric, dict):
                continue
            for candidate in (metric.get("label"), metric.get("name"), metric.get("field"), metric.get("id")):
                normalized_candidate = DecisionChatService._normalize_text(candidate)
                if normalized_candidate and normalized_candidate in normalized_query:
                    matches.append((len(normalized_candidate), metric))
                    break
        if not matches:
            return None
        return sorted(matches, key=lambda item: item[0], reverse=True)[0][1]

    @staticmethod
    def _find_semantic_dimension_reference(user_message: str, semantic_model: Dict[str, Any] | None) -> Dict[str, Any] | None:
        dimensions = semantic_model.get("dimensions") if isinstance(semantic_model, dict) else []
        normalized_query = DecisionChatService._normalize_text(user_message)
        matches: List[Tuple[int, Dict[str, Any]]] = []
        for dimension in dimensions or []:
            if not isinstance(dimension, dict):
                continue
            for candidate in (dimension.get("label"), dimension.get("name"), dimension.get("field"), dimension.get("id")):
                normalized_candidate = DecisionChatService._normalize_text(candidate)
                if normalized_candidate and normalized_candidate in normalized_query:
                    matches.append((len(normalized_candidate), dimension))
                    break
        if not matches:
            return None
        return sorted(matches, key=lambda item: item[0], reverse=True)[0][1]

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
        return {
            "type": "chart",
            "title": f"{metric_meta.get('label') or metric_meta.get('name') or 'Metric'} chart",
            "content": {
                "chartType": chart_type,
                "chartData": {
                    "labels": labels,
                    "datasets": [{
                        "label": metric_meta.get("label") or metric_meta.get("name") or "Metric",
                        "data": values,
                    }],
                },
                "fieldsUsed": {
                    "value": metric_meta.get("field") or metric_meta.get("label"),
                    "category": ((metric_result.get("group_by") or [{}])[0]).get("field") if metric_result.get("group_by") else None,
                },
                "filtersApplied": metric_result.get("filters") or [],
                "meta": {
                    "type": chart_type,
                    "source": "semantic_metric",
                },
            },
        }

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
            },
        }

    @staticmethod
    def _build_metric_summary_message(metric_result: Dict[str, Any]) -> str:
        metric_meta = metric_result.get("metric") or {}
        metric_label = metric_meta.get("label") or metric_meta.get("name") or "Metric"
        summary = metric_result.get("summary") or {}
        rows = list(metric_result.get("rows") or [])
        summary_value = DecisionChatService._format_value(summary.get("value"), metric_meta.get("format_hint"))
        if not rows or len(rows) == 1 and not rows[0].get("group"):
            return f"{metric_label} is {summary_value} for the current grounded context."

        top_row = rows[0]
        top_group = DecisionChatService._format_group_label(top_row.get("group") or {})
        top_value = DecisionChatService._format_value(top_row.get("value"), metric_meta.get("format_hint"))
        return f"{metric_label} totals {summary_value}. The top result is {top_group} at {top_value}."

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
            chart_response = build_chart_response(
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
    def _format_group_label(group_values: Dict[str, Any]) -> str:
        if not group_values:
            return "All Data"
        return " | ".join(f"{field}: {value}" for field, value in group_values.items())

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
        return f"{summary} {readiness_meaning} {truthfulness_note} Recommended next action: {next_label}."

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
                availability_reason="A structured draft workspace exists and can be opened in Decisions.",
            ),
        ]
