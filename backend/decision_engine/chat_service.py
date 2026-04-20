"""Phase 4 chat orchestration for Decision Intelligence."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Tuple

from backend.decision_engine.grounding import build_grounding_summary
from backend.decision_engine.mode_detection import detect_chat_mode, is_visualization_request
from backend.services.aichat_nlp import analyse_columns, build_chart_response, extract_dataset, interpret_nl_query
from backend.services.decision_support import DecisionServiceError
from backend.services.metric_resolver import MetricResolutionError, MetricResolver
from backend.services.decision_workspace_service import DecisionWorkspaceService


class DecisionChatService:
    """
    First Phase 4 backend slice for chat-first Decision Intelligence.

    The service keeps the contract stable and grounded while we build out the
    larger decision engine package behind it.
    """

    CONTRACT_VERSION = "di_v3_phase4_chat_v1"
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
        mode = detect_chat_mode(user_message, session_state)
        if mode == "ask" and DecisionChatService._should_attempt_analytics(user_message, dataset, semantic_model, session_state):
            mode = "explore"

        artifacts: List[Dict[str, Any]] = []
        warnings: List[str] = []
        assistant_message = ""
        draft_workspace = DecisionChatService._extract_workspace(payload, session_state)
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

        # Decision prompts reuse the prompt-first workspace draft rather than inventing new logic.
        elif mode == "decide":
            if draft_workspace is None:
                draft_workspace = DecisionChatService._create_draft_workspace(payload, user_message)
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

        updated_state = {
            **session_state,
            "active_mode": mode,
            "decision_prompt": session_state.get("decision_prompt") or user_message,
            "available_actions": available_actions,
        }
        if analytic_state:
            updated_state["last_analytic_context"] = analytic_state
        if draft_workspace is not None:
            updated_state["draft_workspace"] = draft_workspace
            updated_state["missing_inputs"] = list((draft_workspace.get("readiness") or {}).get("missing_inputs") or [])

        return {
            "status": "success",
            "contract_version": DecisionChatService.CONTRACT_VERSION,
            "assistant_message": assistant_message,
            "mode": mode,
            "suggested_actions": available_actions,
            "artifacts": artifacts,
            "draft_workspace_preview": (
                DecisionChatService._build_workspace_preview(draft_workspace)
                if draft_workspace is not None
                else None
            ),
            "session_state": updated_state,
            "grounding_summary": grounding_summary,
            "warnings": warnings,
        }

    @staticmethod
    def handle_action(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        action = str(payload.get("action") or "").strip().lower()
        if not action:
            raise DecisionServiceError("action is required for decision chat actions.")

        session_state = DecisionChatService._normalize_session_state(payload.get("session_state"))
        workspace = DecisionChatService._extract_workspace(payload, session_state)
        artifacts: List[Dict[str, Any]] = []
        assistant_message = ""
        warnings: List[str] = []

        if action == "draft_workspace":
            prompt = str(payload.get("user_message") or session_state.get("decision_prompt") or "").strip()
            if workspace is None:
                if not prompt:
                    raise DecisionServiceError("A decision prompt is required before a workspace can be drafted.")
                workspace = DecisionChatService._create_draft_workspace(payload, prompt)
            artifacts.append(DecisionChatService._build_workspace_preview(workspace))
            assistant_message = DecisionChatService._build_workspace_preview_message(workspace)

        elif action == "show_assumptions":
            if workspace is None:
                raise DecisionServiceError("A draft workspace is required before assumptions can be shown.")
            assumptions = list(workspace.get("assumptions") or [])
            artifacts.append({
                "type": "workspace_analysis_summary",
                "title": "Current assumptions",
                "content": {
                    "items": assumptions,
                    "count": len(assumptions),
                },
            })
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
            artifacts.append({
                "type": "workspace_analysis_summary",
                "title": "Current blockers",
                "content": {
                    "items": blockers,
                    "missing_inputs": list((workspace.get("readiness") or {}).get("missing_inputs") or []),
                    "count": len(blockers),
                },
            })
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
            artifacts.append({
                "type": "workspace_analysis_summary",
                "title": "Workspace analysis",
                "content": {
                    "summary": analysis_summary,
                    "scoped_diagnostics": workspace_analysis.get("scoped_diagnostics") or [],
                    "legacy_diagnostics": workspace_analysis.get("legacy_diagnostics") or {},
                },
            })
            assistant_message = summary_headline or "Workspace analysis completed using the current scoped draft."
            warnings = list(analysis_result.get("warnings") or [])

        elif action == "open_workspace":
            if workspace is None:
                raise DecisionServiceError("A draft workspace is required before it can be opened.")
            artifacts.append({
                "type": "workspace_preview",
                "title": "Open workspace handoff",
                "content": DecisionChatService._build_workspace_preview(workspace),
                "handoff": {
                    "target": "decisions",
                    "workspace_id": workspace.get("workspace_id"),
                },
            })
            assistant_message = "Open this draft in the Decisions destination to continue structured work."

        else:
            raise DecisionServiceError(f"Unsupported decision chat action: {action}")

        updated_state = {
            **session_state,
            "active_mode": "decide",
            "draft_workspace": workspace,
            "available_actions": DecisionChatService._build_decision_actions(workspace) if workspace else [],
            "missing_inputs": list((workspace.get("readiness") or {}).get("missing_inputs") or []) if workspace else [],
        }

        return {
            "status": "success",
            "contract_version": DecisionChatService.CONTRACT_VERSION,
            "action": action,
            "assistant_message": assistant_message,
            "artifacts": artifacts,
            "decision_workspace": workspace,
            "session_state": updated_state,
            "warnings": warnings,
        }

    @staticmethod
    def _normalize_session_state(session_state: Any) -> Dict[str, Any]:
        return session_state if isinstance(session_state, dict) else {}

    @staticmethod
    def _extract_workspace(payload: Dict[str, Any], session_state: Dict[str, Any]) -> Dict[str, Any] | None:
        workspace = payload.get("decision_workspace") or payload.get("decisionWorkspace")
        if isinstance(workspace, dict):
            return workspace
        workspace = session_state.get("draft_workspace")
        return workspace if isinstance(workspace, dict) else None

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
        return analytic_state.get("output_preference") == "chart"

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
    def _build_workspace_preview(workspace: Dict[str, Any]) -> Dict[str, Any]:
        decision_scope = workspace.get("decision_scope") if isinstance(workspace.get("decision_scope"), dict) else {}
        readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else {}
        objective = decision_scope.get("objective") if isinstance(decision_scope.get("objective"), dict) else {}
        levers = decision_scope.get("levers") if isinstance(decision_scope.get("levers"), list) else []
        constraints = decision_scope.get("constraints") if isinstance(decision_scope.get("constraints"), list) else []

        return {
            "type": "workspace_preview",
            "workspace_id": workspace.get("workspace_id"),
            "title": workspace.get("title"),
            "status": workspace.get("status"),
            "scope_summary": workspace.get("scope_summary"),
            "objective": {
                "statement": objective.get("statement"),
                "direction": objective.get("direction"),
                "metric": ((objective.get("metric_ref") or {}).get("label") or objective.get("metric_id")),
            },
            "lever_count": len(levers),
            "constraint_count": len(constraints),
            "missing_inputs": list(readiness.get("missing_inputs") or []),
            "unknown_count": len(workspace.get("unknowns") or []),
        }

    @staticmethod
    def _build_workspace_preview_message(workspace: Dict[str, Any]) -> str:
        preview = DecisionChatService._build_workspace_preview(workspace)
        objective = preview.get("objective") or {}
        objective_label = objective.get("statement") or "this decision"
        missing_inputs = preview.get("missing_inputs") or []
        if missing_inputs:
            return (
                f"I drafted a workspace for {objective_label}. "
                f"It still needs {len(missing_inputs)} missing input(s) before deeper execution."
            )
        return f"I drafted a scoped workspace for {objective_label}. You can inspect it or open it in Decisions."

    @staticmethod
    def _build_decision_actions(workspace: Dict[str, Any] | None) -> List[Dict[str, Any]]:
        if not isinstance(workspace, dict) or not workspace:
            return []
        return [
            {"action_id": "draft_workspace", "label": "Draft workspace", "enabled": True},
            {"action_id": "show_assumptions", "label": "Show assumptions", "enabled": True},
            {"action_id": "show_blockers", "label": "Show blockers", "enabled": True},
            {"action_id": "analyze_workspace", "label": "Analyze workspace", "enabled": True},
            {"action_id": "open_workspace", "label": "Open workspace", "enabled": True},
        ]
