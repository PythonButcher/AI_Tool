"""Display-ready decision output composer for AI Chat."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional

from backend.services.advanced_readiness_service import AdvancedReadinessService


class DecisionOutputService:
    """Compose an additive AI Chat artifact from existing decision workspace data."""

    TRUTH_BOUNDARY = "observational_analysis_only"
    REQUIRED_EXPORT_SECTION_IDS = (
        "executive_brief",
        "dataset_trust",
        "goal",
        "drivers",
        "limits",
        "breakdowns",
        "evidence_board",
        "decision_map_summary",
        "scenario_compare",
        "advanced_readiness",
        "assumptions_unknowns",
        "truth_boundary",
    )
    EVIDENCE_STRENGTHS = {"strong", "moderate", "weak", "insufficient"}
    OBSERVATIONAL_LIMITATION = (
        "This evidence is observational only; it is not advice, a causal claim, "
        "an optimization result, or a final recommendation."
    )

    @staticmethod
    def compose(
        *,
        workspace: Dict[str, Any],
        dataset_trust: Dict[str, Any],
        workspace_analysis: Optional[Dict[str, Any]] = None,
        correction_result: Optional[Dict[str, Any]] = None,
        scenario_preview: Optional[Dict[str, Any]] = None,
        governance_readiness: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        workspace = workspace if isinstance(workspace, dict) else {}
        dataset_trust = dataset_trust if isinstance(dataset_trust, dict) else {}
        workspace_analysis = workspace_analysis if isinstance(workspace_analysis, dict) else None
        correction_result = correction_result if isinstance(correction_result, dict) else None
        scenario_preview = scenario_preview if isinstance(scenario_preview, dict) else None
        governance_readiness = (
            governance_readiness if isinstance(governance_readiness, dict) else None
        )

        frame = DecisionOutputService._build_frame(workspace)
        readiness = DecisionOutputService._build_readiness(workspace)
        evidence_board = DecisionOutputService._build_evidence_board(workspace_analysis)
        correction_state = DecisionOutputService._build_correction_state(workspace, correction_result)
        scenario_compare = DecisionOutputService._build_scenario_compare(scenario_preview)
        # Advanced readiness is an additive diagnostic over existing backend
        # truth. It must not change legacy gates or enable an advanced action.
        advanced_readiness = AdvancedReadinessService.evaluate(
            frame=frame,
            dataset_trust=dataset_trust,
            decision_readiness=readiness,
            evidence_board=evidence_board,
            governance_readiness=governance_readiness,
        )
        advanced_gates = DecisionOutputService._build_advanced_gates(readiness)
        decision_map = DecisionOutputService._build_decision_map(
            workspace=workspace,
            dataset_trust=dataset_trust,
            frame=frame,
            evidence_board=evidence_board,
            advanced_gates=advanced_gates,
        )
        summary = DecisionOutputService._build_summary(
            workspace=workspace,
            readiness=readiness,
            workspace_analysis=workspace_analysis,
            evidence_board=evidence_board,
        )
        export_sections = DecisionOutputService._build_export_sections(
            summary=summary,
            dataset_trust=dataset_trust,
            frame=frame,
            evidence_board=evidence_board,
            decision_map=decision_map,
            scenario_compare=scenario_compare,
            readiness=readiness,
            advanced_readiness=advanced_readiness,
        )
        source_refs = DecisionOutputService._build_source_refs(
            workspace=workspace,
            workspace_analysis=workspace_analysis,
            correction_result=correction_result,
            scenario_preview=scenario_preview,
        )
        command_center = DecisionOutputService._build_command_center(
            dataset_trust=dataset_trust,
            frame=frame,
            readiness=readiness,
            evidence_board=evidence_board,
            decision_map=decision_map,
            scenario_compare=scenario_compare,
            advanced_gates=advanced_gates,
            export_sections=export_sections,
            source_refs=source_refs,
        )

        output = {
            "type": "decision_output",
            "render_hint": "decision_output",
            "inspectable": True,
            "default_view": "inspector",
            "schema_version": "di_phase3_decision_output_v1",
            "title": DecisionOutputService._build_title(workspace),
            "summary": summary,
            "dataset_trust": deepcopy(dataset_trust),
            "frame": frame,
            "readiness": readiness,
            "correction_state": correction_state,
            "evidence_board": evidence_board,
            "decision_map": decision_map,
            "scenario_compare": scenario_compare,
            "advanced_readiness": advanced_readiness,
            "advanced_gates": advanced_gates,
            "command_center": command_center,
            "export_sections": export_sections,
            "source_refs": source_refs,
            "truth_boundary": DecisionOutputService.TRUTH_BOUNDARY,
        }
        return output

    @staticmethod
    def _build_title(workspace: Dict[str, Any]) -> str:
        title = str(workspace.get("title") or "").strip()
        if title:
            return f"Decision output: {title}"
        return "Decision output"

    @staticmethod
    def _build_summary(
        *,
        workspace: Dict[str, Any],
        readiness: Dict[str, Any],
        workspace_analysis: Optional[Dict[str, Any]],
        evidence_board: Dict[str, Any],
    ) -> str:
        analysis_summary = workspace_analysis.get("summary") if isinstance(workspace_analysis, dict) else None
        if isinstance(analysis_summary, dict):
            headline = str(analysis_summary.get("headline") or analysis_summary.get("summary") or "").strip()
            if headline:
                return headline
        elif analysis_summary:
            return str(analysis_summary).strip()

        title = str(workspace.get("title") or "this decision").strip()
        readiness_state = str(readiness.get("readiness_state") or "unknown").strip()
        missing = list(readiness.get("missing_inputs") or [])
        if readiness_state == "analysis_ready":
            return (
                f"The decision frame for {title} is ready for observational analysis. "
                "No final recommendation, simulation, optimization, or autonomous decisioning is performed."
            )
        if missing:
            return (
                f"The decision frame for {title} needs clarification before observational analysis: "
                f"{', '.join(str(item) for item in missing)}."
            )
        if evidence_board.get("status") == "analyzed":
            return "Observational evidence has been prepared for the current decision frame."
        return "A structured decision output draft is available for review."

    @staticmethod
    def _build_frame(workspace: Dict[str, Any]) -> Dict[str, Any]:
        decision_scope = workspace.get("decision_scope") if isinstance(workspace.get("decision_scope"), dict) else {}
        objective = decision_scope.get("objective") if isinstance(decision_scope.get("objective"), dict) else {}
        levers = decision_scope.get("levers") if isinstance(decision_scope.get("levers"), list) else []
        constraints = decision_scope.get("constraints") if isinstance(decision_scope.get("constraints"), list) else []
        segment_dimensions = (
            decision_scope.get("segment_dimensions")
            if isinstance(decision_scope.get("segment_dimensions"), list)
            else []
        )
        return {
            "goal": deepcopy(objective),
            "drivers": deepcopy(levers),
            "limits": deepcopy(constraints),
            "breakdowns": deepcopy(segment_dimensions),
            "assumptions": deepcopy(workspace.get("assumptions") if isinstance(workspace.get("assumptions"), list) else []),
            "unknowns": deepcopy(workspace.get("unknowns") if isinstance(workspace.get("unknowns"), list) else []),
            "scope_summary": workspace.get("scope_summary"),
        }

    @staticmethod
    def _build_readiness(workspace: Dict[str, Any]) -> Dict[str, Any]:
        readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else {}
        normalized = deepcopy(readiness)
        normalized.setdefault("truth_boundary", DecisionOutputService.TRUTH_BOUNDARY)
        normalized.setdefault("readiness_state", "blocked")
        normalized.setdefault("missing_inputs", [])
        normalized.setdefault("allowed_next_actions", [])
        normalized.setdefault("unsupported_capabilities", [
            "simulation",
            "optimization",
            "autonomous_decisioning",
            "final_recommendation",
        ])
        normalized.setdefault("not_ready_for_recommendation", True)
        return normalized

    @staticmethod
    def _build_correction_state(
        workspace: Dict[str, Any],
        correction_result: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        correction_history = workspace.get("correction_history") if isinstance(workspace.get("correction_history"), list) else []
        latest = correction_result or (correction_history[-1] if correction_history else None)
        status = "updated" if isinstance(correction_result, dict) or correction_history else "not_applied"
        return {
            "status": status,
            "latest": deepcopy(latest) if isinstance(latest, dict) else None,
            "history_count": len(correction_history),
            "truth_boundary": DecisionOutputService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def _build_evidence_board(workspace_analysis: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not isinstance(workspace_analysis, dict):
            return {
                "status": "not_analyzed",
                "summary": "Run analyze_workspace to prepare ranked observational evidence.",
                "items": [],
                "observational_boundary": DecisionOutputService.TRUTH_BOUNDARY,
            }

        ranked_diagnostics = (
            workspace_analysis.get("ranked_diagnostics")
            if isinstance(workspace_analysis.get("ranked_diagnostics"), list)
            else []
        )
        items = [
            DecisionOutputService._build_evidence_item(index=index, diagnostic=diagnostic)
            for index, diagnostic in enumerate(ranked_diagnostics, start=1)
            if isinstance(diagnostic, dict)
        ]
        summary = workspace_analysis.get("summary")
        if isinstance(summary, dict):
            summary_text = str(summary.get("headline") or summary.get("summary") or "").strip()
        else:
            summary_text = str(summary or "").strip()
        if not items and not summary_text:
            summary_text = "Analysis ran, but no ranked diagnostics were available for the current decision frame."
        return {
            "status": "analyzed",
            "summary": summary_text or "Ranked observational evidence is available for this decision frame.",
            "items": items,
            "observational_boundary": workspace_analysis.get("observational_boundary") or DecisionOutputService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def _build_evidence_item(index: int, diagnostic: Dict[str, Any]) -> Dict[str, Any]:
        rank = DecisionOutputService._coerce_positive_int(diagnostic.get("evidence_rank"), index)
        source_id = DecisionOutputService._source_diagnostic_id(diagnostic)
        covers = DecisionOutputService._build_evidence_covers(diagnostic)
        strength = DecisionOutputService._normalize_evidence_strength(diagnostic)
        data_sufficiency = DecisionOutputService._normalize_data_sufficiency(diagnostic, strength)
        limitations = DecisionOutputService._normalize_evidence_limitations(diagnostic, strength, data_sufficiency)
        return {
            "rank": rank,
            "title": DecisionOutputService._build_evidence_title(diagnostic, rank),
            "summary": DecisionOutputService._build_evidence_summary(diagnostic),
            "covers": covers,
            "strength": strength,
            "data_sufficiency": data_sufficiency,
            "limitations": limitations,
            "source_diagnostic_id": source_id,
            "source_refs": DecisionOutputService._evidence_source_refs(
                diagnostic=diagnostic,
                rank=rank,
                source_id=source_id,
            ),
            "next_checks": DecisionOutputService._build_evidence_next_checks(
                diagnostic=diagnostic,
                rank=rank,
                source_id=source_id,
                covers=covers,
                data_sufficiency=data_sufficiency,
                limitations=limitations,
            ),
            "observational_boundary": diagnostic.get("observational_boundary") or DecisionOutputService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def _build_evidence_title(diagnostic: Dict[str, Any], rank: int) -> str:
        explicit_title = str(diagnostic.get("title") or "").strip()
        if explicit_title:
            return explicit_title
        metric_ref = diagnostic.get("metric_ref") if isinstance(diagnostic.get("metric_ref"), dict) else {}
        dimension_ref = diagnostic.get("dimension_ref") if isinstance(diagnostic.get("dimension_ref"), dict) else {}
        label = metric_ref.get("label") or dimension_ref.get("label") or diagnostic.get("focus_role")
        if label:
            return f"Evidence {rank}: {label}"
        return f"Evidence {rank}"

    @staticmethod
    def _build_evidence_summary(diagnostic: Dict[str, Any]) -> str:
        summary = str(diagnostic.get("summary") or "").strip()
        if summary:
            return summary
        source_diagnostic = (
            diagnostic.get("source_diagnostic")
            if isinstance(diagnostic.get("source_diagnostic"), dict)
            else {}
        )
        source_summary = str(source_diagnostic.get("summary") or "").strip()
        if source_summary:
            return source_summary
        status = str(diagnostic.get("status") or source_diagnostic.get("status") or "diagnostic").replace("_", " ")
        return f"Evidence item is available from a ranked {status} diagnostic."

    @staticmethod
    def _build_evidence_covers(diagnostic: Dict[str, Any]) -> Dict[str, Any]:
        coverage = diagnostic.get("semantic_coverage") if isinstance(diagnostic.get("semantic_coverage"), dict) else {}
        return {
            "goal": bool(coverage.get("objective")),
            "drivers": DecisionOutputService._list_of_dicts(coverage.get("levers")),
            "limits": DecisionOutputService._list_of_dicts(coverage.get("guardrails")),
            "breakdowns": DecisionOutputService._list_of_dicts(coverage.get("segments")),
            "context_roles": DecisionOutputService._list_of_strings(diagnostic.get("role_tags")),
            "temporal": bool(coverage.get("temporal")),
        }

    @staticmethod
    def _normalize_evidence_strength(diagnostic: Dict[str, Any]) -> str:
        strength = str(diagnostic.get("evidence_strength") or "").strip().lower()
        if strength in DecisionOutputService.EVIDENCE_STRENGTHS:
            return strength
        data_sufficiency = diagnostic.get("data_sufficiency") if isinstance(diagnostic.get("data_sufficiency"), dict) else {}
        status = str(data_sufficiency.get("status") or "").strip().lower()
        if status in {"sufficient", "ready"}:
            return "moderate"
        if status in {"limited", "partial"}:
            return "weak"
        return "insufficient"

    @staticmethod
    def _normalize_data_sufficiency(diagnostic: Dict[str, Any], strength: str) -> Dict[str, Any]:
        source = diagnostic.get("data_sufficiency") if isinstance(diagnostic.get("data_sufficiency"), dict) else {}
        evidence = diagnostic.get("evidence") if isinstance(diagnostic.get("evidence"), dict) else {}
        if strength in {"strong", "moderate"}:
            default_status = "sufficient"
        elif strength == "weak":
            default_status = "limited"
        else:
            default_status = "insufficient"
        normalized = deepcopy(source)
        normalized["status"] = str(normalized.get("status") or default_status)
        normalized["row_count"] = normalized.get("row_count", evidence.get("row_count"))
        normalized["has_period_comparison"] = bool(
            normalized.get("has_period_comparison")
            or diagnostic.get("status") == "observed_change"
        )
        normalized.setdefault(
            "summary",
            DecisionOutputService._data_sufficiency_summary(normalized["status"]),
        )
        return normalized

    @staticmethod
    def _data_sufficiency_summary(status: str) -> str:
        normalized = str(status or "").strip().lower()
        if normalized == "sufficient":
            return "The diagnostic has enough observed data for descriptive comparison."
        if normalized == "limited":
            return "The diagnostic has partial evidence and should be read with caution."
        if normalized == "insufficient":
            return "The diagnostic does not have enough observed data for a reliable comparison."
        return "Data sufficiency could not be fully determined from the diagnostic payload."

    @staticmethod
    def _normalize_evidence_limitations(
        diagnostic: Dict[str, Any],
        strength: str,
        data_sufficiency: Dict[str, Any],
    ) -> List[str]:
        limitations = DecisionOutputService._list_of_strings(diagnostic.get("limitations"))
        if DecisionOutputService.OBSERVATIONAL_LIMITATION not in limitations:
            limitations.append(DecisionOutputService.OBSERVATIONAL_LIMITATION)
        sufficiency_status = str(data_sufficiency.get("status") or "").lower()
        if strength in {"weak", "insufficient"} or sufficiency_status in {"limited", "insufficient"}:
            limitations.append("Evidence strength is limited; use this item as a prompt for review, not as a decision rule.")
        return DecisionOutputService._dedupe_strings(limitations)

    @staticmethod
    def _source_diagnostic_id(diagnostic: Dict[str, Any]) -> Optional[str]:
        source_diagnostic = (
            diagnostic.get("source_diagnostic")
            if isinstance(diagnostic.get("source_diagnostic"), dict)
            else {}
        )
        source_id = diagnostic.get("source_diagnostic_id") or diagnostic.get("diagnostic_id") or source_diagnostic.get("diagnostic_id")
        return str(source_id) if source_id else None

    @staticmethod
    def _evidence_source_refs(
        *,
        diagnostic: Dict[str, Any],
        rank: int,
        source_id: Optional[str],
    ) -> Dict[str, Any]:
        metric_ref = diagnostic.get("metric_ref") if isinstance(diagnostic.get("metric_ref"), dict) else {}
        dimension_ref = diagnostic.get("dimension_ref") if isinstance(diagnostic.get("dimension_ref"), dict) else {}
        source_diagnostic = diagnostic.get("source_diagnostic") if isinstance(diagnostic.get("source_diagnostic"), dict) else {}
        return {
            "source": "evidence_board",
            "source_path": f"evidence_board.items[{rank - 1}]",
            "source_diagnostic_id": source_id,
            "metric_id": metric_ref.get("metric_id") or metric_ref.get("id") or source_diagnostic.get("metric_id"),
            "dimension_id": dimension_ref.get("dimension_id") or dimension_ref.get("id") or source_diagnostic.get("dimension_id"),
            "field": dimension_ref.get("field") or source_diagnostic.get("field"),
        }

    @staticmethod
    def _build_evidence_next_checks(
        *,
        diagnostic: Dict[str, Any],
        rank: int,
        source_id: Optional[str],
        covers: Dict[str, Any],
        data_sufficiency: Dict[str, Any],
        limitations: List[str],
    ) -> List[Dict[str, Any]]:
        source_refs = DecisionOutputService._evidence_source_refs(
            diagnostic=diagnostic,
            rank=rank,
            source_id=source_id,
        )
        metric_id = source_refs.get("metric_id")
        dimension_id = source_refs.get("dimension_id") or source_refs.get("field")
        sufficiency_status = str(data_sufficiency.get("status") or "").strip().lower()
        has_breakdown_context = bool(dimension_id or covers.get("breakdowns"))
        has_observed_metric = bool(metric_id)
        scenario_ready = has_observed_metric and sufficiency_status not in {"limited", "insufficient"}

        checks = [
            DecisionOutputService._next_check(
                check_id="explain_evidence",
                label="Explain evidence",
                description="Explain this ranked evidence item, its source diagnostic, and its observational limits.",
                source="evidence_board",
                action_id="explain_evidence",
                source_refs=source_refs,
                limitations=limitations,
            )
        ]
        if has_observed_metric and has_breakdown_context:
            checks.append(DecisionOutputService._next_check(
                check_id="breakdown",
                label="Break down evidence",
                description="Prepare a metric-by-breakdown follow-up check for this evidence item.",
                source="evidence_board",
                action_id="breakdown",
                source_refs=source_refs,
                limitations=limitations,
            ))
        else:
            checks.append(DecisionOutputService._disabled_next_check(
                check_id="breakdown",
                label="Break down evidence",
                source="evidence_board",
                reason="Breakdown needs both an observed metric target and a breakdown dimension from the evidence source.",
                action_id="breakdown",
                source_refs=source_refs,
                limitations=limitations,
            ))

        if has_observed_metric:
            checks.append(DecisionOutputService._next_check(
                check_id="monitor",
                label="Monitor evidence",
                description="Prepare an observational monitoring specification for this metric evidence.",
                source="evidence_board",
                action_id="monitor",
                source_refs=source_refs,
                limitations=limitations,
            ))
        else:
            checks.append(DecisionOutputService._disabled_next_check(
                check_id="monitor",
                label="Monitor evidence",
                source="evidence_board",
                reason="Monitoring needs an observed metric target from the evidence source.",
                action_id="monitor",
                source_refs=source_refs,
                limitations=limitations,
            ))

        if scenario_ready:
            checks.append(DecisionOutputService._next_check(
                check_id="send_to_scenario_compare",
                label="Send to Scenario Compare",
                description="Prepare a bounded direct-adjustment Scenario Compare check from this observed metric target.",
                source="evidence_board",
                action_id="send_to_scenario_compare",
                source_refs=source_refs,
                limitations=limitations,
            ))
        else:
            reason = (
                "Scenario Compare needs an observed metric target with sufficient evidence."
                if has_observed_metric
                else "Scenario Compare needs an observed metric target; no metric target was found on this evidence item."
            )
            checks.append(DecisionOutputService._disabled_next_check(
                check_id="send_to_scenario_compare",
                label="Send to Scenario Compare",
                source="evidence_board",
                reason=reason,
                action_id="send_to_scenario_compare",
                source_refs=source_refs,
                limitations=limitations,
            ))

        return checks

    @staticmethod
    def _coerce_positive_int(value: Any, fallback: int) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = int(fallback)
        return parsed if parsed > 0 else int(fallback)

    @staticmethod
    def _list_of_dicts(value: Any) -> List[Dict[str, Any]]:
        if not isinstance(value, list):
            return []
        return [deepcopy(item) for item in value if isinstance(item, dict)]

    @staticmethod
    def _list_of_strings(value: Any) -> List[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    @staticmethod
    def _dedupe_strings(values: List[str]) -> List[str]:
        seen = set()
        deduped: List[str] = []
        for value in values:
            text = str(value or "").strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(text)
        return deduped

    @staticmethod
    def _build_decision_map(
        *,
        workspace: Dict[str, Any],
        dataset_trust: Dict[str, Any],
        frame: Dict[str, Any],
        evidence_board: Dict[str, Any],
        advanced_gates: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        dataset = dataset_trust.get("dataset") if isinstance(dataset_trust.get("dataset"), dict) else {}
        dataset_node_id = "dataset_active"
        nodes.append({
            "node_id": dataset_node_id,
            "node_type": "dataset",
            "label": dataset.get("dataset_name") or dataset_trust.get("source_label") or "Dataset",
            "summary": "Dataset context used for this decision output.",
            "status": "available" if dataset else "missing",
            "source_path": "dataset_trust.dataset",
            "confidence": None,
            "warnings": list(dataset_trust.get("warnings") or []),
        })

        goal = frame.get("goal") if isinstance(frame.get("goal"), dict) else {}
        goal_target_id = dataset_node_id
        if goal:
            goal_target_id = "goal_1"
            nodes.append(DecisionOutputService._map_node(
                node_id="goal_1",
                node_type="goal",
                label=DecisionOutputService._label_from_ref(goal, fallback="Goal"),
                source_path="frame.goal",
                status=goal.get("resolution_status") or "draft",
                summary=goal.get("statement"),
                confidence=goal.get("semantic_binding_confidence"),
            ))
            edges.append(DecisionOutputService._map_edge(dataset_node_id, "goal_1", "declared_relationship", "Dataset grounds goal review"))

        for index, driver in enumerate(frame.get("drivers") or [], start=1):
            node_id = f"driver_{index}"
            nodes.append(DecisionOutputService._map_node(
                node_id=node_id,
                node_type="driver",
                label=DecisionOutputService._label_from_ref(driver, fallback=f"Driver {index}"),
                source_path=f"frame.drivers[{index - 1}]",
                status=((driver.get("binding") or {}).get("status") if isinstance(driver.get("binding"), dict) else None) or "draft",
                summary=driver.get("description"),
                confidence=((driver.get("binding") or {}).get("semantic_binding_confidence") if isinstance(driver.get("binding"), dict) else None),
            ))
            edges.append(DecisionOutputService._map_edge(node_id, goal_target_id, "declared_relationship", "Driver is part of the framed goal review"))

        for index, limit in enumerate(frame.get("limits") or [], start=1):
            node_id = f"limit_{index}"
            nodes.append(DecisionOutputService._map_node(
                node_id=node_id,
                node_type="limit",
                label=DecisionOutputService._label_from_ref(limit, fallback=f"Limit {index}"),
                source_path=f"frame.limits[{index - 1}]",
                status=((limit.get("binding") or {}).get("status") if isinstance(limit.get("binding"), dict) else None) or "draft",
                summary=limit.get("description") or limit.get("rationale"),
                confidence=((limit.get("binding") or {}).get("semantic_binding_confidence") if isinstance(limit.get("binding"), dict) else None),
            ))
            edges.append(DecisionOutputService._map_edge(node_id, goal_target_id, "constraint", "Limit constrains the framed decision"))

        for index, breakdown in enumerate(frame.get("breakdowns") or [], start=1):
            node_id = f"breakdown_{index}"
            nodes.append(DecisionOutputService._map_node(
                node_id=node_id,
                node_type="breakdown",
                label=DecisionOutputService._label_from_ref(breakdown, fallback=f"Breakdown {index}"),
                source_path=f"frame.breakdowns[{index - 1}]",
                status=((breakdown.get("binding") or {}).get("status") if isinstance(breakdown.get("binding"), dict) else None) or "draft",
                confidence=((breakdown.get("binding") or {}).get("semantic_binding_confidence") if isinstance(breakdown.get("binding"), dict) else None),
            ))
            edges.append(DecisionOutputService._map_edge(goal_target_id, node_id, "breakdown", "Goal can be reviewed by this breakdown"))

        missing_inputs = list((workspace.get("readiness") or {}).get("missing_inputs") or [])
        for index, missing in enumerate(missing_inputs, start=1):
            node_id = f"unknown_missing_{index}"
            nodes.append(DecisionOutputService._map_node(
                node_id=node_id,
                node_type="unknown",
                label=str(missing),
                source_path=f"readiness.missing_inputs[{index - 1}]",
                status="missing",
                summary="Required input is missing before deeper analysis can run.",
            ))
            edges.append(DecisionOutputService._map_edge(node_id, goal_target_id, "missing_evidence", "Missing input blocks or limits analysis"))

        for item in evidence_board.get("items") or []:
            node_id = f"evidence_{item.get('rank')}"
            nodes.append(DecisionOutputService._map_node(
                node_id=node_id,
                node_type="evidence",
                label=item.get("title") or node_id,
                source_path=f"evidence_board.items[{int(item.get('rank') or 1) - 1}]",
                status=item.get("strength") or "insufficient",
                summary=item.get("summary"),
            ))
            edges.append(DecisionOutputService._map_edge(node_id, goal_target_id, "observed_association", "Evidence is observational and non-causal"))

        for index, gate in enumerate(advanced_gates, start=1):
            node_id = f"advanced_gate_{index}"
            nodes.append(DecisionOutputService._map_node(
                node_id=node_id,
                node_type="advanced_gate",
                label=gate.get("capability") or f"Gate {index}",
                source_path=f"advanced_gates[{index - 1}]",
                status=gate.get("status") or "unsupported",
                summary=gate.get("reason"),
            ))
            edges.append(DecisionOutputService._map_edge(goal_target_id, node_id, "constraint", "Capability is gated by current truth boundary"))

        return {
            "status": "available",
            "nodes": nodes,
            "edges": edges,
            "causal_status": "not_causal_claim",
            "summary": "Map shows declared frame structure and observational evidence coverage only.",
        }

    @staticmethod
    def _label_from_ref(item: Dict[str, Any], *, fallback: str) -> str:
        if item.get("label"):
            return str(item.get("label"))
        if item.get("statement"):
            return str(item.get("statement"))
        binding = item.get("binding") if isinstance(item.get("binding"), dict) else {}
        metric_ref = binding.get("metric_ref") if isinstance(binding.get("metric_ref"), dict) else {}
        dimension_ref = binding.get("dimension_ref") if isinstance(binding.get("dimension_ref"), dict) else {}
        objective_metric = item.get("metric_ref") if isinstance(item.get("metric_ref"), dict) else {}
        return str(
            metric_ref.get("label")
            or dimension_ref.get("label")
            or objective_metric.get("label")
            or fallback
        )

    @staticmethod
    def _map_node(
        *,
        node_id: str,
        node_type: str,
        label: str,
        source_path: str,
        status: Optional[str] = None,
        summary: Optional[str] = None,
        confidence: Optional[Any] = None,
        warnings: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        return {
            "node_id": node_id,
            "node_type": node_type,
            "label": label,
            "summary": summary,
            "status": status or "draft",
            "source_path": source_path,
            "confidence": confidence,
            "warnings": list(warnings or []),
            "source_refs": {
                "source": "decision_map",
                "node_id": node_id,
                "node_type": node_type,
                "source_path": source_path,
            },
            "next_checks": DecisionOutputService._build_map_item_next_checks(
                item_kind="node",
                item_id=node_id,
                item_type=node_type,
                source_path=source_path,
                status=status or "draft",
                warnings=list(warnings or []),
            ),
        }

    @staticmethod
    def _map_edge(source_node_id: str, target_node_id: str, relationship_type: str, label: str) -> Dict[str, Any]:
        edge_id = f"edge_{source_node_id}_to_{target_node_id}_{relationship_type}"
        return {
            "edge_id": edge_id,
            "source_node_id": source_node_id,
            "target_node_id": target_node_id,
            "relationship_type": relationship_type,
            "label": label,
            "evidence_refs": [],
            "limitations": ["This edge is not a causal claim."],
            "causal_status": "not_causal_claim",
            "source_refs": {
                "source": "decision_map",
                "edge_id": edge_id,
                "relationship_type": relationship_type,
                "source_node_id": source_node_id,
                "target_node_id": target_node_id,
            },
            "next_checks": DecisionOutputService._build_map_item_next_checks(
                item_kind="edge",
                item_id=edge_id,
                item_type=relationship_type,
                source_path="decision_map.edges",
                status="available",
                warnings=[],
            ),
        }

    @staticmethod
    def _build_map_item_next_checks(
        *,
        item_kind: str,
        item_id: str,
        item_type: str,
        source_path: str,
        status: str,
        warnings: List[str],
    ) -> List[Dict[str, Any]]:
        source_refs = {
            "source": "decision_map",
            "item_kind": item_kind,
            "item_id": item_id,
            "item_type": item_type,
            "source_path": source_path,
        }
        limitations = ["Decision Map items are observational and non-causal."]
        if warnings:
            limitations.extend(warnings)
        checks = [
            DecisionOutputService._next_check(
                check_id="explain_evidence",
                label="Explain map item",
                description="Explain the selected map item, its source path, and the observational boundary.",
                source="decision_map",
                action_id="explain_evidence",
                source_refs=source_refs,
                limitations=limitations,
            )
        ]
        missing_or_limited = status in {"missing", "blocked", "unsupported", "insufficient"}
        if missing_or_limited or warnings:
            checks.append(DecisionOutputService._next_check(
                check_id="explain_missing_data",
                label="Explain missing data",
                description="Explain missing inputs, warnings, or unsupported capability gates for this map item.",
                source="decision_map",
                action_id="explain_missing_data",
                source_refs=source_refs,
                limitations=limitations,
            ))
        else:
            checks.append(DecisionOutputService._disabled_next_check(
                check_id="explain_missing_data",
                label="Explain missing data",
                source="decision_map",
                reason="This map item is not currently marked as missing, blocked, unsupported, or warning-bearing.",
                action_id="explain_missing_data",
                source_refs=source_refs,
                limitations=limitations,
            ))
        for check_id, label, reason in (
            (
                "breakdown",
                "Break down",
                "Decision Map items do not carry a complete metric and dimension target; use Evidence Board or Decision Graph items for breakdown checks.",
            ),
            (
                "monitor",
                "Monitor",
                "Decision Map items do not carry a metric target for monitoring; use Evidence Board or Decision Graph metric items.",
            ),
            (
                "send_to_scenario_compare",
                "Send to Scenario Compare",
                "Decision Map items cannot start Scenario Compare without an observed metric target and direct-adjustment input.",
            ),
        ):
            checks.append(DecisionOutputService._disabled_next_check(
                check_id=check_id,
                label=label,
                source="decision_map",
                reason=reason,
                action_id=check_id,
                source_refs=source_refs,
                limitations=limitations,
            ))
        return checks

    @staticmethod
    def _build_scenario_compare(scenario_preview: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not isinstance(scenario_preview, dict):
            return DecisionOutputService._scenario_compare_not_applicable(
                "No bounded scenario preview is attached to this decision output."
            )

        preview_status = str(scenario_preview.get("status") or "not_applicable").strip().lower()
        projections = DecisionOutputService._list_of_dicts(scenario_preview.get("projections"))
        if preview_status != "ready":
            summary = str(
                scenario_preview.get("summary")
                or "Scenario Compare is not applicable for this decision output."
            ).strip()
            return DecisionOutputService._scenario_compare_not_applicable(summary)
        if not projections:
            return DecisionOutputService._scenario_compare_not_applicable(
                "Scenario Compare is not applicable because the scenario preview did not include projection data."
            )

        inputs = DecisionOutputService._normalize_scenario_inputs(scenario_preview.get("suggested_inputs"))
        normalized_projections = [
            DecisionOutputService._normalize_scenario_projection(projection)
            for projection in projections
        ]
        baseline = DecisionOutputService._build_scenario_baseline(
            projections=normalized_projections,
            period_context=scenario_preview.get("period_context"),
        )
        comparison = DecisionOutputService._build_scenario_comparison(
            scenario_preview=scenario_preview,
            inputs=inputs,
            projections=normalized_projections,
        )
        assumptions = DecisionOutputService._dedupe_strings(
            DecisionOutputService._list_of_strings(scenario_preview.get("assumptions"))
            + [
                "Scenario Compare applies direct adjustments to observed metric baselines only.",
                "It is not a forecast, not an optimizer, not a simulation, not a causal model, and not a final recommendation.",
            ]
        )
        limitations = DecisionOutputService._dedupe_strings(
            [
                "Scenario Compare is a bounded direct adjustment or sensitivity comparison.",
                "It does not estimate causal effects, future demand, uncertainty bands, or optimal actions.",
                "Use the comparison as an observational planning aid, not as a decision rule.",
            ]
        )
        target_count = len(normalized_projections)
        return {
            "status": "ready",
            "summary": (
                f"Prepared bounded Scenario Compare for {target_count} metric target"
                f"{'s' if target_count != 1 else ''} using direct adjustments on observed baselines."
            ),
            "inputs": inputs,
            "baseline": baseline,
            "comparison": comparison,
            "projections": normalized_projections,
            "assumptions": assumptions,
            "limitations": limitations,
            "source_scenario_ids": DecisionOutputService._scenario_source_ids(scenario_preview),
            "truth_boundary": DecisionOutputService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def _scenario_compare_not_applicable(summary: str) -> Dict[str, Any]:
        return {
            "status": "not_applicable",
            "summary": summary,
            "inputs": {
                "name": None,
                "filters": [],
                "group_by": [],
                "metric_targets": [],
            },
            "baseline": {
                "status": "not_available",
                "metrics": [],
                "period_context": None,
            },
            "comparison": {
                "method": "direct_adjustment_sensitivity",
                "status": "not_available",
                "target_count": 0,
                "group_by": [],
                "based_on_recommendation_ids": [],
                "based_on_signal_ids": [],
                "period_context": None,
            },
            "projections": [],
            "assumptions": [
                "Scenario Compare applies direct adjustments to observed metric baselines only when scenario data is available."
            ],
            "limitations": [
                "No scenario projection data was available for this decision output.",
                "It is not a forecast, not an optimizer, not a simulation, not a causal model, and not a final recommendation.",
            ],
            "source_scenario_ids": [],
            "truth_boundary": DecisionOutputService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def _normalize_scenario_inputs(value: Any) -> Dict[str, Any]:
        inputs = value if isinstance(value, dict) else {}
        return {
            "name": inputs.get("name"),
            "filters": DecisionOutputService._list_of_dicts(inputs.get("filters")),
            "group_by": DecisionOutputService._list_of_strings(inputs.get("group_by") or inputs.get("groupBy")),
            "metric_targets": DecisionOutputService._list_of_dicts(inputs.get("metric_targets") or inputs.get("metricTargets")),
        }

    @staticmethod
    def _normalize_scenario_projection(projection: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "metric_ref": deepcopy(projection.get("metric_ref") or {}),
            "adjustment": deepcopy(projection.get("adjustment") or {}),
            "baseline_value": projection.get("baseline_value"),
            "baseline_label": projection.get("baseline_label"),
            "projected_value": projection.get("projected_value"),
            "projected_label": projection.get("projected_label"),
            "delta_value": projection.get("delta_value"),
            "delta_pct": projection.get("delta_pct"),
            "comparison_summary": deepcopy(projection.get("comparison_summary")) if isinstance(projection.get("comparison_summary"), dict) else None,
        }

    @staticmethod
    def _build_scenario_baseline(
        *,
        projections: List[Dict[str, Any]],
        period_context: Any,
    ) -> Dict[str, Any]:
        metrics = []
        for projection in projections:
            metrics.append({
                "metric_ref": deepcopy(projection.get("metric_ref") or {}),
                "baseline_value": projection.get("baseline_value"),
                "baseline_label": projection.get("baseline_label"),
            })
        return {
            "status": "available" if metrics else "not_available",
            "metrics": metrics,
            "period_context": deepcopy(period_context) if isinstance(period_context, dict) else None,
        }

    @staticmethod
    def _build_scenario_comparison(
        *,
        scenario_preview: Dict[str, Any],
        inputs: Dict[str, Any],
        projections: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        return {
            "method": "direct_adjustment_sensitivity",
            "status": "available" if projections else "not_available",
            "summary": "Compares observed metric baselines with direct adjustment values.",
            "target_count": len(projections),
            "group_by": list(inputs.get("group_by") or []),
            "based_on_recommendation_ids": DecisionOutputService._list_of_strings(
                scenario_preview.get("based_on_recommendation_ids")
                or scenario_preview.get("basedOnRecommendationIds")
            ),
            "based_on_signal_ids": DecisionOutputService._list_of_strings(
                scenario_preview.get("based_on_signal_ids")
                or scenario_preview.get("basedOnSignalIds")
            ),
            "period_context": deepcopy(scenario_preview.get("period_context")) if isinstance(scenario_preview.get("period_context"), dict) else None,
        }

    @staticmethod
    def _scenario_source_ids(scenario_preview: Dict[str, Any]) -> List[str]:
        source_ids = DecisionOutputService._list_of_strings(
            scenario_preview.get("source_scenario_ids")
            or scenario_preview.get("sourceScenarioIds")
            or scenario_preview.get("scenario_ids")
            or scenario_preview.get("scenarioIds")
        )
        for key in ("source_scenario_id", "sourceScenarioId", "scenario_id", "scenarioId"):
            value = scenario_preview.get(key)
            if isinstance(value, str) and value.strip():
                source_ids.append(value.strip())
        return DecisionOutputService._dedupe_strings(source_ids)

    @staticmethod
    def _build_advanced_gates(readiness: Dict[str, Any]) -> List[Dict[str, Any]]:
        capability_state = readiness.get("capability_state") if isinstance(readiness.get("capability_state"), dict) else {}
        unsupported = list(readiness.get("unsupported_capabilities") or [])
        gates: List[Dict[str, Any]] = []
        for capability in unsupported:
            item = capability_state.get(capability) if isinstance(capability_state.get(capability), dict) else {}
            gates.append({
                "capability": capability,
                "status": item.get("status") or "unsupported",
                "supported": bool(item.get("supported", False)),
                "available": bool(item.get("available", False)),
                "reason": item.get("reason") or f"{capability} is not supported by the current decision runtime.",
                "truth_boundary": DecisionOutputService.TRUTH_BOUNDARY,
            })
        return gates

    @staticmethod
    def _build_command_center(
        *,
        dataset_trust: Dict[str, Any],
        frame: Dict[str, Any],
        readiness: Dict[str, Any],
        evidence_board: Dict[str, Any],
        decision_map: Dict[str, Any],
        scenario_compare: Dict[str, Any],
        advanced_gates: List[Dict[str, Any]],
        export_sections: List[Dict[str, Any]],
        source_refs: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Compose the compact AI Chat command surface from existing output truth."""
        stale_state = str(dataset_trust.get("stale_state") or "unknown")
        readiness_state = str(readiness.get("readiness_state") or "blocked")
        evidence_status = str(evidence_board.get("status") or "not_analyzed")
        scenario_status = str(scenario_compare.get("status") or "not_applicable")
        missing_inputs = DecisionOutputService._list_of_strings(readiness.get("missing_inputs"))
        export_ready = DecisionOutputService.export_sections_ready(export_sections)
        is_analysis_ready = DecisionOutputService._observational_analysis_ready(readiness)
        allowed_next_checks, disabled_next_checks = DecisionOutputService._build_command_center_checks(
            readiness=readiness,
            evidence_board=evidence_board,
            decision_map=decision_map,
            scenario_compare=scenario_compare,
            advanced_gates=advanced_gates,
            export_ready=export_ready,
            is_analysis_ready=is_analysis_ready,
        )
        status = DecisionOutputService._command_center_status(
            readiness_state=readiness_state,
            stale_state=stale_state,
            evidence_status=evidence_status,
            missing_inputs=missing_inputs,
        )

        return {
            "schema_version": "di_command_center_v1",
            "surface": "ai_chat_decision_command_center",
            "status": status,
            "section_order": [section.get("section_id") for section in export_sections if section.get("section_id")],
            "stale_state": stale_state,
            "rerun_state": DecisionOutputService._build_rerun_state(
                is_analysis_ready=is_analysis_ready,
                evidence_status=evidence_status,
                stale_state=stale_state,
                missing_inputs=missing_inputs,
            ),
            "allowed_next_checks": allowed_next_checks,
            "disabled_next_checks": disabled_next_checks,
            "export_readiness": {
                "ready": export_ready,
                "status": "ready" if export_ready else "limited",
                "section_count": len(export_sections),
                "section_order": [section.get("section_id") for section in export_sections if section.get("section_id")],
                "reason": (
                    "Backend export_sections are ready for the AI Chat decision PDF."
                    if export_ready
                    else "Export sections are missing or incomplete."
                ),
            },
            "limitations": DecisionOutputService._build_command_center_limitations(
                dataset_trust=dataset_trust,
                evidence_status=evidence_status,
                scenario_status=scenario_status,
                scenario_compare=scenario_compare,
                advanced_gates=advanced_gates,
            ),
            "source_refs": {
                "workspace_id": source_refs.get("workspace_id"),
                "workspace_status": source_refs.get("workspace_status"),
                "workspace_analysis_present": source_refs.get("workspace_analysis_present"),
                "ranked_diagnostic_ids": list(source_refs.get("ranked_diagnostic_ids") or []),
                "scenario_status": source_refs.get("scenario_status"),
            },
            "truth_boundary": DecisionOutputService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def _build_command_center_checks(
        *,
        readiness: Dict[str, Any],
        evidence_board: Dict[str, Any],
        decision_map: Dict[str, Any],
        scenario_compare: Dict[str, Any],
        advanced_gates: List[Dict[str, Any]],
        export_ready: bool,
        is_analysis_ready: bool,
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        allowed: List[Dict[str, Any]] = [
            DecisionOutputService._next_check(
                check_id="review_decision_frame",
                label="Review decision frame",
                description="Inspect the goal, drivers, limits, breakdowns, assumptions, and unknowns.",
                source="frame",
                source_refs={"source": "frame", "source_path": "decision_output.frame"},
            )
        ]
        disabled: List[Dict[str, Any]] = []

        if is_analysis_ready:
            allowed.append(DecisionOutputService._next_check(
                check_id="run_observational_analysis",
                label="Run observational analysis",
                description="Populate or refresh the Evidence Board from the current decision frame.",
                source="readiness",
                action_id="analyze_workspace",
                source_refs={"source": "readiness", "source_path": "decision_output.readiness"},
            ))
        else:
            disabled.append(DecisionOutputService._disabled_next_check(
                check_id="run_observational_analysis",
                label="Run observational analysis",
                source="readiness",
                reason=DecisionOutputService._missing_inputs_reason(readiness),
                action_id="analyze_workspace",
                source_refs={"source": "readiness", "source_path": "decision_output.readiness"},
            ))

        if evidence_board.get("status") == "analyzed":
            allowed.append(DecisionOutputService._next_check(
                check_id="review_evidence_board",
                label="Review Evidence Board",
                description="Inspect ranked observational evidence and its data sufficiency limits.",
                source="evidence_board",
                source_refs={
                    "source": "evidence_board",
                    "source_path": "decision_output.evidence_board",
                    "item_count": len(evidence_board.get("items") or []),
                },
            ))
        else:
            disabled.append(DecisionOutputService._disabled_next_check(
                check_id="review_evidence_board",
                label="Review Evidence Board",
                source="evidence_board",
                reason="Run observational analysis before reviewing ranked evidence.",
                source_refs={"source": "evidence_board", "source_path": "decision_output.evidence_board"},
            ))

        if decision_map.get("nodes"):
            allowed.append(DecisionOutputService._next_check(
                check_id="review_decision_map",
                label="Review Decision Map",
                description="Inspect declared relationships, evidence coverage, missing inputs, and gates.",
                source="decision_map",
                source_refs={
                    "source": "decision_map",
                    "source_path": "decision_output.decision_map",
                    "node_count": len(decision_map.get("nodes") or []),
                    "edge_count": len(decision_map.get("edges") or []),
                },
            ))

        if scenario_compare.get("status") == "ready":
            allowed.append(DecisionOutputService._next_check(
                check_id="review_scenario_compare",
                label="Review Scenario Compare",
                description="Inspect bounded direct-adjustment sensitivity rows and limitations.",
                source="scenario_compare",
                source_refs={
                    "source": "scenario_compare",
                    "source_path": "decision_output.scenario_compare",
                    "source_scenario_ids": list(scenario_compare.get("source_scenario_ids") or []),
                },
                limitations=DecisionOutputService._list_of_strings(scenario_compare.get("limitations")),
            ))
        else:
            disabled.append(DecisionOutputService._disabled_next_check(
                check_id="review_scenario_compare",
                label="Review Scenario Compare",
                source="scenario_compare",
                reason=DecisionOutputService._scenario_compare_disabled_reason(scenario_compare),
                source_refs={"source": "scenario_compare", "source_path": "decision_output.scenario_compare"},
                limitations=DecisionOutputService._list_of_strings(scenario_compare.get("limitations")),
            ))

        if export_ready:
            allowed.append(DecisionOutputService._next_check(
                check_id="export_decision_output",
                label="Export decision output",
                description="Export the backend-owned decision sections without rebuilding from raw fields.",
                source="export_sections",
                source_refs={
                    "source": "export_sections",
                    "source_path": "decision_output.export_sections",
                },
            ))
        else:
            disabled.append(DecisionOutputService._disabled_next_check(
                check_id="export_decision_output",
                label="Export decision output",
                source="export_sections",
                reason="Export sections are missing or incomplete.",
                source_refs={"source": "export_sections", "source_path": "decision_output.export_sections"},
            ))

        allowed.append(DecisionOutputService._next_check(
            check_id="save_decision_snapshot",
            label="Save immutable snapshot",
            description="Save the current decision output as an immutable observational DecisionAsset.",
            source="decision_asset",
            source_refs={"source": "decision_asset", "source_path": "decision_output"},
        ))

        for gate in advanced_gates:
            capability = str(gate.get("capability") or "").strip()
            if not capability:
                continue
            disabled.append(DecisionOutputService._disabled_next_check(
                check_id=f"unsupported_{capability}",
                label=capability.replace("_", " ").title(),
                source="advanced_gates",
                reason=gate.get("reason") or f"{capability} is unsupported by the current runtime.",
                source_refs={
                    "source": "advanced_gates",
                    "capability": capability,
                    "source_path": "decision_output.advanced_gates",
                },
            ))
        disabled.append(DecisionOutputService._disabled_next_check(
            check_id="live_saved_asset_refresh",
            label="Refresh saved DecisionAsset",
            source="decision_asset",
            reason="Saved DecisionAssets are immutable historical snapshots and do not refresh live data.",
            source_refs={"source": "decision_asset", "source_path": "decision_output"},
        ))
        return allowed, disabled

    @staticmethod
    def _next_check(
        *,
        check_id: str,
        label: str,
        description: str,
        source: str,
        action_id: Optional[str] = None,
        source_refs: Optional[Dict[str, Any]] = None,
        limitations: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        item = {
            "check_id": check_id,
            "label": label,
            "description": description,
            "enabled": True,
            "status": "ready",
            "source": source,
            "action_type": "backend_action" if action_id else "informational_review",
            "source_refs": deepcopy(source_refs) if isinstance(source_refs, dict) else {"source": source},
            "limitations": DecisionOutputService._dedupe_strings(
                DecisionOutputService._list_of_strings(limitations)
                + [DecisionOutputService.OBSERVATIONAL_LIMITATION]
            ),
            "truth_boundary": DecisionOutputService.TRUTH_BOUNDARY,
        }
        if action_id:
            item["action_id"] = action_id
        return item

    @staticmethod
    def _disabled_next_check(
        *,
        check_id: str,
        label: str,
        source: str,
        reason: Any,
        action_id: Optional[str] = None,
        source_refs: Optional[Dict[str, Any]] = None,
        limitations: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        disabled_reason = str(reason or "This check is not available for the current decision output.")
        item = {
            "check_id": check_id,
            "label": label,
            "enabled": False,
            "status": "disabled",
            "source": source,
            "reason": disabled_reason,
            "disabled_reason": disabled_reason,
            "action_type": "backend_action" if action_id else "informational_review",
            "source_refs": deepcopy(source_refs) if isinstance(source_refs, dict) else {"source": source},
            "limitations": DecisionOutputService._dedupe_strings(
                DecisionOutputService._list_of_strings(limitations)
                + [DecisionOutputService.OBSERVATIONAL_LIMITATION]
            ),
            "truth_boundary": DecisionOutputService.TRUTH_BOUNDARY,
        }
        if action_id:
            item["action_id"] = action_id
        return item

    @staticmethod
    def _scenario_compare_disabled_reason(scenario_compare: Dict[str, Any]) -> str:
        inputs = scenario_compare.get("inputs") if isinstance(scenario_compare.get("inputs"), dict) else {}
        targets = inputs.get("metric_targets") if isinstance(inputs.get("metric_targets"), list) else []
        if not targets:
            return "Scenario Compare is disabled because no observed metric target is available for direct adjustment."
        return "No ready direct-adjustment scenario projection is attached to this decision output."

    @staticmethod
    def _observational_analysis_ready(readiness: Dict[str, Any]) -> bool:
        structural = readiness.get("structural_readiness") if isinstance(readiness.get("structural_readiness"), dict) else {}
        if structural.get("ready_for_observational_analysis") is True:
            return True
        if readiness.get("readiness_state") == "analysis_ready":
            return True
        return False

    @staticmethod
    def _missing_inputs_reason(readiness: Dict[str, Any]) -> str:
        missing = DecisionOutputService._list_of_strings(readiness.get("missing_inputs"))
        if missing:
            return f"Complete missing inputs before analysis: {', '.join(missing)}."
        return "The current decision frame is not ready for observational analysis."

    @staticmethod
    def _build_rerun_state(
        *,
        is_analysis_ready: bool,
        evidence_status: str,
        stale_state: str,
        missing_inputs: List[str],
    ) -> Dict[str, Any]:
        if not is_analysis_ready:
            return {
                "status": "blocked",
                "action_id": None,
                "reason": (
                    f"Complete missing inputs before running analysis: {', '.join(missing_inputs)}."
                    if missing_inputs
                    else "Complete the decision frame before running observational analysis."
                ),
            }
        if evidence_status == "analyzed":
            status = "possibly_stale_analysis_available" if stale_state in {"possibly_stale", "unknown"} else "current_analysis_available"
            return {
                "status": status,
                "action_id": "analyze_workspace",
                "reason": "Run observational analysis again after changing the frame or dataset.",
            }
        return {
            "status": "analysis_not_run",
            "action_id": "analyze_workspace",
            "reason": "Run observational analysis to populate the Evidence Board.",
        }

    @staticmethod
    def _command_center_status(
        *,
        readiness_state: str,
        stale_state: str,
        evidence_status: str,
        missing_inputs: List[str],
    ) -> str:
        if readiness_state == "blocked" or missing_inputs:
            return "blocked"
        if stale_state in {"possibly_stale", "unknown"} or evidence_status != "analyzed":
            return "limited"
        return "ready"

    @classmethod
    def export_sections_ready(cls, export_sections: List[Dict[str, Any]]) -> bool:
        """Require every canonical backend section before claiming PDF readiness."""
        if not isinstance(export_sections, list) or not export_sections:
            return False
        section_ids = [
            str(section.get("section_id") or "").strip()
            for section in export_sections
            if isinstance(section, dict)
        ]
        required_present = set(cls.REQUIRED_EXPORT_SECTION_IDS).issubset(section_ids)
        return required_present and len(section_ids) == len(set(section_ids)) and all(
            isinstance(section, dict)
            and bool(str(section.get("section_id") or "").strip())
            and bool(str(section.get("title") or "").strip())
            and bool(str(section.get("body") or "").strip())
            for section in export_sections
        )

    @staticmethod
    def _build_command_center_limitations(
        *,
        dataset_trust: Dict[str, Any],
        evidence_status: str,
        scenario_status: str,
        scenario_compare: Dict[str, Any],
        advanced_gates: List[Dict[str, Any]],
    ) -> List[str]:
        limitations = [
            "The command center is observational decision support only; it does not make a final recommendation.",
            "It does not perform prediction, simulation, optimization, causal proof, or autonomous decisioning.",
            "Saved DecisionAssets remain immutable historical snapshots and do not refresh live data.",
        ]
        stale_state = str(dataset_trust.get("stale_state") or "unknown")
        if stale_state in {"possibly_stale", "unknown"}:
            limitations.append(f"Dataset freshness is {stale_state}; review Dataset Trust before acting on the output.")
        if evidence_status != "analyzed":
            limitations.append("Evidence Board is not populated until observational analysis runs.")
        if scenario_status != "ready":
            limitations.append("Scenario Compare is unavailable unless a bounded direct-adjustment scenario preview is attached.")
        limitations.extend(DecisionOutputService._list_of_strings(dataset_trust.get("warnings")))
        limitations.extend(DecisionOutputService._list_of_strings(scenario_compare.get("limitations")))
        limitations.extend([
            str(gate.get("reason"))
            for gate in advanced_gates
            if isinstance(gate, dict) and gate.get("reason")
        ])
        return DecisionOutputService._dedupe_strings(limitations)

    @staticmethod
    def _build_export_sections(
        *,
        summary: str,
        dataset_trust: Dict[str, Any],
        frame: Dict[str, Any],
        evidence_board: Dict[str, Any],
        decision_map: Dict[str, Any],
        scenario_compare: Dict[str, Any],
        readiness: Dict[str, Any],
        advanced_readiness: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        # Keep these sections self-contained because the PDF export path renders
        # this backend-owned payload directly instead of re-reading workspace internals.
        dataset = dataset_trust.get("dataset") if isinstance(dataset_trust.get("dataset"), dict) else {}
        goal = frame.get("goal") if isinstance(frame.get("goal"), dict) else {}
        drivers = frame.get("drivers") if isinstance(frame.get("drivers"), list) else []
        limits = frame.get("limits") if isinstance(frame.get("limits"), list) else []
        breakdowns = frame.get("breakdowns") if isinstance(frame.get("breakdowns"), list) else []
        assumptions = frame.get("assumptions") if isinstance(frame.get("assumptions"), list) else []
        unknowns = frame.get("unknowns") if isinstance(frame.get("unknowns"), list) else []
        evidence_items = evidence_board.get("items") if isinstance(evidence_board.get("items"), list) else []
        scenario_projections = (
            scenario_compare.get("projections")
            if isinstance(scenario_compare.get("projections"), list)
            else []
        )
        scenario_comparison = (
            scenario_compare.get("comparison")
            if isinstance(scenario_compare.get("comparison"), dict)
            else {}
        )
        unsupported = DecisionOutputService._dedupe_strings(
            list(readiness.get("unsupported_capabilities") or [])
            + ["simulation", "optimization", "autonomous_decisioning", "final_recommendation"]
        )
        return [
            DecisionOutputService._export_section(
                section_id="executive_brief",
                title="Executive Brief",
                body=summary,
                keyValues=[
                    {"label": "Readiness", "value": readiness.get("readiness_state")},
                    {"label": "Truth Boundary", "value": readiness.get("truth_boundary") or DecisionOutputService.TRUTH_BOUNDARY},
                ],
                items=[
                    "This is a decision-support export from AI Chat, not a final recommendation.",
                    "The output preserves the current observational-only reliability boundary.",
                ],
            ),
            DecisionOutputService._export_section(
                section_id="dataset_trust",
                title="Dataset Trust",
                body=(
                    "Dataset Trust summarizes what data powered this AI Chat decision output and where "
                    "the backend could not prove source, freshness, or preparation state."
                ),
                keyValues=[
                    {"label": "Source", "value": dataset_trust.get("source_label") or "Unknown"},
                    {"label": "Dataset", "value": dataset.get("dataset_name")},
                    {"label": "Dataset ID", "value": dataset.get("dataset_id")},
                    {"label": "Rows", "value": dataset_trust.get("row_count")},
                    {"label": "Columns", "value": dataset_trust.get("column_count")},
                    {"label": "Semantic Ready", "value": DecisionOutputService._yes_no(dataset_trust.get("semantic_ready"))},
                    {"label": "Transform State", "value": dataset_trust.get("transform_state")},
                    {"label": "Freshness", "value": dataset_trust.get("stale_state")},
                ],
                items=list(dataset_trust.get("warnings") or []),
                emptyText="No dataset trust warnings were provided.",
            ),
            DecisionOutputService._export_section(
                section_id="goal",
                title="Goal",
                body="The goal is the primary outcome or decision question the rest of this asset is organized around.",
                cards=[DecisionOutputService._export_frame_card(goal, fallback="Goal")] if goal else [],
                emptyText="No goal is available in the current decision frame.",
            ),
            DecisionOutputService._export_section(
                section_id="drivers",
                title="Drivers",
                body="Drivers are controllable or reviewable inputs connected to the framed goal.",
                cards=[
                    DecisionOutputService._export_frame_card(driver, fallback=f"Driver {index}")
                    for index, driver in enumerate(drivers, start=1)
                    if isinstance(driver, dict)
                ],
                emptyText="No drivers are available in the current decision frame.",
            ),
            DecisionOutputService._export_section(
                section_id="limits",
                title="Limits",
                body="Limits are guardrails, constraints, or protected outcomes that should bound interpretation.",
                cards=[
                    DecisionOutputService._export_frame_card(limit, fallback=f"Limit {index}")
                    for index, limit in enumerate(limits, start=1)
                    if isinstance(limit, dict)
                ],
                emptyText="No limits are available in the current decision frame.",
            ),
            DecisionOutputService._export_section(
                section_id="breakdowns",
                title="Breakdowns",
                body="Breakdowns are the segments or dimensions intended for comparing the goal and drivers.",
                cards=[
                    DecisionOutputService._export_frame_card(breakdown, fallback=f"Breakdown {index}")
                    for index, breakdown in enumerate(breakdowns, start=1)
                    if isinstance(breakdown, dict)
                ],
                emptyText="No breakdown dimensions are available in the current decision frame.",
            ),
            DecisionOutputService._export_section(
                section_id="evidence_board",
                title="Evidence Board",
                body=evidence_board.get("summary"),
                cards=[
                    {
                        "title": item.get("title"),
                        "body": item.get("summary"),
                        "meta": [
                            {"label": "Rank", "value": item.get("rank")},
                            {"label": "Strength", "value": item.get("strength")},
                            {
                                "label": "Data Sufficiency",
                                "value": (item.get("data_sufficiency") or {}).get("status")
                                if isinstance(item.get("data_sufficiency"), dict)
                                else None,
                            },
                            {"label": "Source", "value": item.get("source_diagnostic_id")},
                        ],
                    }
                    for item in evidence_items
                    if isinstance(item, dict)
                ],
                items=DecisionOutputService._dedupe_strings([
                    limitation
                    for item in evidence_items
                    if isinstance(item, dict)
                    for limitation in (item.get("limitations") or [])
                ]),
                emptyText="No ranked evidence is available yet. Run observational analysis to populate the Evidence Board.",
            ),
            DecisionOutputService._export_section(
                section_id="decision_map_summary",
                title="Decision Map Summary",
                body=decision_map.get("summary"),
                keyValues=[
                    {"label": "Map Status", "value": decision_map.get("status")},
                    {"label": "Nodes", "value": len(decision_map.get("nodes") or [])},
                    {"label": "Edges", "value": len(decision_map.get("edges") or [])},
                    {"label": "Causal Status", "value": decision_map.get("causal_status") or "not_causal_claim"},
                ],
                items=[
                    "Map edges show declared structure, evidence coverage, missing inputs, or gates only.",
                    "Decision Map edges are not causal proof.",
                ],
            ),
            DecisionOutputService._export_section(
                section_id="scenario_compare",
                title="Scenario Compare",
                body=scenario_compare.get("summary"),
                keyValues=[
                    {"label": "Status", "value": scenario_compare.get("status")},
                    {"label": "Method", "value": scenario_comparison.get("method")},
                    {"label": "Projection Count", "value": len(scenario_projections)},
                    {"label": "Group By", "value": ", ".join(scenario_comparison.get("group_by") or [])},
                ],
                cards=[
                    DecisionOutputService._export_scenario_projection_card(projection, index)
                    for index, projection in enumerate(scenario_projections, start=1)
                    if isinstance(projection, dict)
                ],
                items=DecisionOutputService._dedupe_strings(
                    list(scenario_compare.get("assumptions") or [])
                    + list(scenario_compare.get("limitations") or [])
                ),
                emptyText="No scenario projection rows are available for this decision output.",
            ),
            DecisionOutputService._export_section(
                section_id="advanced_readiness",
                title="Advanced Readiness",
                body=advanced_readiness.get("summary"),
                keyValues=[
                    {"label": "Overall State", "value": advanced_readiness.get("overall_state")},
                    {"label": "Supported", "value": (advanced_readiness.get("state_counts") or {}).get("supported")},
                    {"label": "Limited", "value": (advanced_readiness.get("state_counts") or {}).get("limited")},
                    {"label": "Blocked", "value": (advanced_readiness.get("state_counts") or {}).get("blocked")},
                    {"label": "Not Evaluated", "value": (advanced_readiness.get("state_counts") or {}).get("not_evaluated")},
                    {"label": "Truth Boundary", "value": advanced_readiness.get("truth_boundary") or DecisionOutputService.TRUTH_BOUNDARY},
                ],
                cards=[
                    DecisionOutputService._export_advanced_readiness_card(capability)
                    for capability in (advanced_readiness.get("capabilities") or [])
                    if isinstance(capability, dict)
                ],
                items=DecisionOutputService._dedupe_strings(advanced_readiness.get("limitations") or []),
                emptyText="No advanced readiness capability diagnostics are available.",
            ),
            DecisionOutputService._export_section(
                section_id="assumptions_unknowns",
                title="Assumptions and Unknowns",
                body="These are the declared assumptions and unresolved information gaps that bound interpretation.",
                cards=[
                    *[
                        DecisionOutputService._export_note_card(item, fallback=f"Assumption {index}", note_type="Assumption")
                        for index, item in enumerate(assumptions, start=1)
                    ],
                    *[
                        DecisionOutputService._export_note_card(item, fallback=f"Unknown {index}", note_type="Unknown")
                        for index, item in enumerate(unknowns, start=1)
                    ],
                ],
                emptyText="No assumptions or unknowns are available in the current decision frame.",
            ),
            DecisionOutputService._export_section(
                section_id="truth_boundary",
                title="Truth Boundary",
                body=(
                    "This asset is limited to observational decision support. It can organize data, frame "
                    "evidence, and show bounded sensitivity comparisons, but it does not decide for the user."
                ),
                keyValues=[
                    {"label": "Boundary", "value": readiness.get("truth_boundary") or DecisionOutputService.TRUTH_BOUNDARY},
                    {"label": "Unsupported Capabilities", "value": ", ".join(unsupported)},
                    {"label": "Ready For Final Recommendation", "value": DecisionOutputService._yes_no(not readiness.get("not_ready_for_recommendation", True))},
                ],
                items=[
                    "No final recommendation is produced.",
                    "No simulation, optimization, causal proof, prediction certainty, or autonomous decisioning is performed.",
                    "Use this export for review and follow-up analysis, not as an autonomous decision record.",
                ],
            ),
        ]

    @staticmethod
    def _export_section(
        section_id: str,
        title: str,
        body: Optional[Any] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        body_text = str(body or "").strip()
        section = {
            "section_id": section_id,
            "title": title,
            "summary": body_text,
            "body": body_text,
        }
        for key, value in extra.items():
            if value is None:
                continue
            section[key] = value
        return section

    @staticmethod
    def _export_frame_card(item: Dict[str, Any], *, fallback: str) -> Dict[str, Any]:
        binding = item.get("binding") if isinstance(item.get("binding"), dict) else {}
        metric_ref = binding.get("metric_ref") if isinstance(binding.get("metric_ref"), dict) else {}
        dimension_ref = binding.get("dimension_ref") if isinstance(binding.get("dimension_ref"), dict) else {}
        objective_metric = item.get("metric_ref") if isinstance(item.get("metric_ref"), dict) else {}
        label = DecisionOutputService._label_from_ref(item, fallback=fallback)
        body = (
            item.get("statement")
            or item.get("description")
            or item.get("rationale")
            or binding.get("binding_label")
            or metric_ref.get("label")
            or dimension_ref.get("label")
            or objective_metric.get("label")
            or label
        )
        return {
            "title": label,
            "body": body,
            "meta": [
                {"label": "Status", "value": item.get("resolution_status") or binding.get("status")},
                {"label": "Metric", "value": metric_ref.get("label") or objective_metric.get("label")},
                {"label": "Dimension", "value": dimension_ref.get("label")},
                {"label": "Confidence", "value": item.get("semantic_binding_confidence") or binding.get("semantic_binding_confidence")},
            ],
        }

    @staticmethod
    def _export_note_card(item: Any, *, fallback: str, note_type: str) -> Dict[str, Any]:
        if isinstance(item, dict):
            title = str(item.get("label") or item.get("title") or item.get("name") or fallback)
            body = str(item.get("description") or item.get("summary") or item.get("statement") or item.get("value") or title)
            status = item.get("status") or item.get("resolution_status")
        else:
            title = fallback
            body = str(item or fallback)
            status = None
        return {
            "title": title,
            "body": body,
            "meta": [
                {"label": "Type", "value": note_type},
                {"label": "Status", "value": status},
            ],
        }

    @staticmethod
    def _export_advanced_readiness_card(capability: Dict[str, Any]) -> Dict[str, Any]:
        capability_name = str(capability.get("capability") or "advanced capability").strip()
        reasons = [
            str(item.get("message") or "").strip()
            for item in (capability.get("reasons") or [])
            if isinstance(item, dict) and str(item.get("message") or "").strip()
        ]
        evidence = [
            f"{item.get('label')}: {item.get('value')}"
            for item in (capability.get("evidence") or [])
            if isinstance(item, dict) and item.get("label") and item.get("value") is not None
        ]
        missing = [
            str(item.get("description") or "").strip().rstrip(" .;")
            for item in (capability.get("missing_requirements") or [])
            if isinstance(item, dict) and str(item.get("description") or "").strip()
        ]
        body_parts = reasons
        if evidence:
            body_parts.append(f"Evidence: {'; '.join(evidence)}.")
        if missing:
            body_parts.append(f"Missing requirements: {'; '.join(missing)}.")
        return {
            "title": capability_name.replace("_", " ").title(),
            "body": " ".join(body_parts) or "No readiness explanation was provided.",
            "meta": [
                {"label": "State", "value": capability.get("state")},
                {"label": "Truth Boundary", "value": capability.get("truth_boundary") or DecisionOutputService.TRUTH_BOUNDARY},
            ],
        }

    @staticmethod
    def _export_scenario_projection_card(projection: Dict[str, Any], index: int) -> Dict[str, Any]:
        metric_ref = projection.get("metric_ref") if isinstance(projection.get("metric_ref"), dict) else {}
        adjustment = projection.get("adjustment") if isinstance(projection.get("adjustment"), dict) else {}
        return {
            "title": metric_ref.get("label") or metric_ref.get("name") or f"Projection {index}",
            "body": DecisionOutputService._format_scenario_projection_body(projection),
            "meta": [
                {"label": "Adjustment", "value": DecisionOutputService._format_adjustment(adjustment)},
                {"label": "Baseline", "value": projection.get("baseline_label") or projection.get("baseline_value")},
                {"label": "Projected", "value": projection.get("projected_label") or projection.get("projected_value")},
                {"label": "Delta", "value": projection.get("delta_value")},
                {"label": "Delta Percent", "value": projection.get("delta_pct")},
            ],
        }

    @staticmethod
    def _format_scenario_projection_body(projection: Dict[str, Any]) -> str:
        comparison_summary = projection.get("comparison_summary")
        if isinstance(comparison_summary, str) and comparison_summary.strip():
            return comparison_summary.strip()

        parts = ["Direct adjustment sensitivity comparison."]
        if isinstance(comparison_summary, dict):
            direction = comparison_summary.get("direction")
            delta_pct = comparison_summary.get("delta_pct")
            if direction:
                parts.append(f"Direction: {direction}.")
            if delta_pct is not None:
                parts.append(f"Delta percent: {delta_pct}.")
        elif projection.get("delta_pct") is not None:
            parts.append(f"Delta percent: {projection.get('delta_pct')}.")
        return " ".join(parts)

    @staticmethod
    def _format_adjustment(adjustment: Dict[str, Any]) -> Optional[str]:
        if not adjustment:
            return None
        adjustment_type = adjustment.get("type") or adjustment.get("adjustment_type")
        value = adjustment.get("value") if "value" in adjustment else adjustment.get("adjustment_value")
        if adjustment_type and value is not None:
            return f"{adjustment_type}: {value}"
        if value is not None:
            return str(value)
        return str(adjustment_type) if adjustment_type else None

    @staticmethod
    def _yes_no(value: Any) -> str:
        return "Yes" if bool(value) else "No"

    @staticmethod
    def _build_source_refs(
        *,
        workspace: Dict[str, Any],
        workspace_analysis: Optional[Dict[str, Any]],
        correction_result: Optional[Dict[str, Any]],
        scenario_preview: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        ranked = workspace_analysis.get("ranked_diagnostics") if isinstance(workspace_analysis, dict) else []
        diagnostic_ids = [
            DecisionOutputService._source_diagnostic_id(item)
            for item in (ranked if isinstance(ranked, list) else [])
            if isinstance(item, dict) and DecisionOutputService._source_diagnostic_id(item)
        ]
        return {
            "workspace_id": workspace.get("workspace_id"),
            "workspace_status": workspace.get("status"),
            "workspace_analysis_present": isinstance(workspace_analysis, dict),
            "ranked_diagnostic_ids": diagnostic_ids,
            "correction_status": DecisionOutputService._resolve_correction_status(workspace, correction_result),
            "scenario_status": scenario_preview.get("status") if isinstance(scenario_preview, dict) else None,
            "truth_boundary": DecisionOutputService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def _resolve_correction_status(
        workspace: Dict[str, Any],
        correction_result: Optional[Dict[str, Any]],
    ) -> Optional[str]:
        if isinstance(correction_result, dict):
            return correction_result.get("status") or "applied"
        correction_history = (
            workspace.get("correction_history")
            if isinstance(workspace.get("correction_history"), list)
            else []
        )
        if correction_history:
            return "applied"
        return None
