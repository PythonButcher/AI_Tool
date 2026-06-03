"""Display-ready decision output composer for AI Chat."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional


class DecisionOutputService:
    """Compose an additive AI Chat artifact from existing decision workspace data."""

    TRUTH_BOUNDARY = "observational_analysis_only"
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
    ) -> Dict[str, Any]:
        workspace = workspace if isinstance(workspace, dict) else {}
        dataset_trust = dataset_trust if isinstance(dataset_trust, dict) else {}
        workspace_analysis = workspace_analysis if isinstance(workspace_analysis, dict) else None
        correction_result = correction_result if isinstance(correction_result, dict) else None
        scenario_preview = scenario_preview if isinstance(scenario_preview, dict) else None

        frame = DecisionOutputService._build_frame(workspace)
        readiness = DecisionOutputService._build_readiness(workspace)
        evidence_board = DecisionOutputService._build_evidence_board(workspace_analysis)
        correction_state = DecisionOutputService._build_correction_state(workspace, correction_result)
        advanced_gates = DecisionOutputService._build_advanced_gates(readiness)
        decision_map = DecisionOutputService._build_decision_map(
            workspace=workspace,
            dataset_trust=dataset_trust,
            frame=frame,
            evidence_board=evidence_board,
            advanced_gates=advanced_gates,
        )
        scenario_compare = DecisionOutputService._build_scenario_compare(scenario_preview)
        summary = DecisionOutputService._build_summary(
            workspace=workspace,
            readiness=readiness,
            workspace_analysis=workspace_analysis,
            evidence_board=evidence_board,
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
            "advanced_gates": advanced_gates,
            "export_sections": DecisionOutputService._build_export_sections(
                summary=summary,
                dataset_trust=dataset_trust,
                frame=frame,
                evidence_board=evidence_board,
                decision_map=decision_map,
                scenario_compare=scenario_compare,
                readiness=readiness,
            ),
            "source_refs": DecisionOutputService._build_source_refs(
                workspace=workspace,
                workspace_analysis=workspace_analysis,
                correction_result=correction_result,
                scenario_preview=scenario_preview,
            ),
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
        }

    @staticmethod
    def _map_edge(source_node_id: str, target_node_id: str, relationship_type: str, label: str) -> Dict[str, Any]:
        return {
            "edge_id": f"edge_{source_node_id}_to_{target_node_id}_{relationship_type}",
            "source_node_id": source_node_id,
            "target_node_id": target_node_id,
            "relationship_type": relationship_type,
            "label": label,
            "evidence_refs": [],
            "limitations": ["This edge is not a causal claim."],
            "causal_status": "not_causal_claim",
        }

    @staticmethod
    def _build_scenario_compare(scenario_preview: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not isinstance(scenario_preview, dict):
            return {
                "status": "not_applicable",
                "summary": "No bounded scenario preview is attached to this decision output.",
                "inputs": {},
                "baseline": None,
                "comparison": None,
                "projections": [],
                "assumptions": [
                    "Scenario Compare is a bounded direct-adjustment preview when available; it is not a forecast or causal simulation."
                ],
                "limitations": ["No scenario preview was generated for this response."],
                "source_scenario_ids": [],
            }
        return {
            "status": scenario_preview.get("status") or "ready",
            "summary": scenario_preview.get("summary") or "Scenario preview is available.",
            "inputs": deepcopy(scenario_preview.get("suggested_inputs") or {}),
            "baseline": scenario_preview.get("baseline"),
            "comparison": scenario_preview.get("comparison"),
            "projections": deepcopy(scenario_preview.get("projections") or []),
            "assumptions": list(scenario_preview.get("assumptions") or []),
            "limitations": [
                "Scenario Compare uses direct adjustments only and is not a forecast, optimizer, or causal simulation."
            ],
            "source_scenario_ids": list(scenario_preview.get("source_scenario_ids") or []),
        }

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
    def _build_export_sections(
        *,
        summary: str,
        dataset_trust: Dict[str, Any],
        frame: Dict[str, Any],
        evidence_board: Dict[str, Any],
        decision_map: Dict[str, Any],
        scenario_compare: Dict[str, Any],
        readiness: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        return [
            {
                "section_id": "executive_brief",
                "title": "Executive Brief",
                "summary": summary,
                "items": [],
            },
            {
                "section_id": "dataset_trust",
                "title": "Dataset Trust",
                "summary": dataset_trust.get("source_label") or "Dataset source is unknown.",
                "items": list(dataset_trust.get("warnings") or []),
            },
            {
                "section_id": "decision_frame",
                "title": "Decision Frame",
                "summary": frame.get("scope_summary") or "Decision frame drafted from the current workspace.",
                "items": [
                    f"Drivers: {len(frame.get('drivers') or [])}",
                    f"Limits: {len(frame.get('limits') or [])}",
                    f"Breakdowns: {len(frame.get('breakdowns') or [])}",
                ],
            },
            {
                "section_id": "evidence_board",
                "title": "Evidence Board",
                "summary": evidence_board.get("summary"),
                "items": [item.get("title") for item in evidence_board.get("items") or [] if item.get("title")],
            },
            {
                "section_id": "decision_map",
                "title": "Decision Map",
                "summary": decision_map.get("summary"),
                "items": [f"Nodes: {len(decision_map.get('nodes') or [])}", f"Edges: {len(decision_map.get('edges') or [])}"],
            },
            {
                "section_id": "scenario_compare",
                "title": "Scenario Compare",
                "summary": scenario_compare.get("summary"),
                "items": list(scenario_compare.get("limitations") or []),
            },
            {
                "section_id": "truth_boundary",
                "title": "Truth Boundary",
                "summary": readiness.get("truth_boundary") or DecisionOutputService.TRUTH_BOUNDARY,
                "items": [
                    "No final recommendation is produced.",
                    "No simulation, optimization, causal proof, or autonomous decisioning is performed.",
                ],
            },
        ]

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
