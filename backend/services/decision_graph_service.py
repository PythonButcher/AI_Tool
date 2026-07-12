"""Backend-owned Decision Graph candidate and edge composer."""

from __future__ import annotations

from copy import deepcopy
import math
from typing import Any, Dict, List, Optional, Sequence, Tuple

import pandas as pd

from backend.services.decision_support import (
    DecisionServiceError,
    build_dimension_ref,
    build_metric_ref,
    make_identifier,
    resolve_decision_context,
    rounded,
)
from backend.services.metric_resolver import MetricResolver


class DecisionGraphService:
    """Build cold, inspectable graph data without advanced inference claims."""

    CONTRACT_VERSION = "di_phase7_3_decision_graph_v1"
    TRUTH_BOUNDARY = "observational_analysis_only"
    DEFAULT_MODE = "mixed"
    GRAPH_MODES = {"evidence_coverage", "observed_association", "mixed"}
    GRAPH_ACTIONS = {
        "breakdown",
        "monitor",
        "explain_evidence",
        "explain_missing_data",
        "send_to_scenario_compare",
    }
    MIN_PAIR_SAMPLE_SIZE = 3
    SUFFICIENT_PAIR_SAMPLE_SIZE = 4

    @staticmethod
    def discover_candidates(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        context = DecisionGraphService._resolve_context(payload)
        candidates = DecisionGraphService._build_variable_candidates(context)
        return {
            "status": "success",
            "contract_version": DecisionGraphService.CONTRACT_VERSION,
            "type": "decision_graph_candidates",
            "schema_version": DecisionGraphService.CONTRACT_VERSION,
            "dataset": context["dataset"],
            "variable_candidates": candidates,
            "data_sufficiency": DecisionGraphService._dataset_sufficiency(context),
            "limitations": [
                "Candidates are limited to semantic metrics and dimensions that can be inspected in the current dataset."
            ],
            "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def build_graph(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        context = DecisionGraphService._resolve_context(payload)
        graph_mode = DecisionGraphService._normalize_graph_mode(payload.get("graph_mode") or payload.get("graphMode"))
        candidates = DecisionGraphService._build_variable_candidates(context)
        candidate_map = {candidate["variable_id"]: candidate for candidate in candidates}
        selected_variables = DecisionGraphService._resolve_selected_variables(payload, candidate_map)
        evidence_items = DecisionGraphService._resolve_selected_evidence_items(payload)

        nodes = DecisionGraphService._build_variable_nodes(selected_variables)
        edges: List[Dict[str, Any]] = []

        if graph_mode in {"evidence_coverage", "mixed"}:
            evidence_nodes, coverage_edges = DecisionGraphService._build_evidence_coverage(
                payload=payload,
                selected_variables=selected_variables,
                evidence_items=evidence_items,
            )
            nodes.extend(evidence_nodes)
            edges.extend(coverage_edges)

        if graph_mode in {"observed_association", "mixed"}:
            edges.extend(DecisionGraphService._build_observed_associations(context, selected_variables, payload))

        hypothesis_edges, hypothesis_limitations = DecisionGraphService._build_user_hypothesis_edges(
            payload=payload,
            selected_variables=selected_variables,
        )
        edges.extend(hypothesis_edges)
        for edge in edges:
            edge["followup_actions"] = DecisionGraphService._followup_actions_for_edge(edge)

        graph_sufficiency = DecisionGraphService._graph_sufficiency(
            context=context,
            selected_variables=selected_variables,
            edges=edges,
        )
        limitations = [
            "Decision Graph edges report descriptive evidence only and should be reviewed with their sufficiency notes."
        ]
        if not selected_variables:
            limitations.append("No selected variables were resolved from the request.")
        if not edges:
            limitations.append("No graph edges could be built from the selected variables and evidence.")
        limitations.extend(hypothesis_limitations)

        return {
            "status": "success",
            "contract_version": DecisionGraphService.CONTRACT_VERSION,
            "type": "decision_graph",
            "render_hint": "decision_graph",
            "schema_version": DecisionGraphService.CONTRACT_VERSION,
            "graph_mode": graph_mode,
            "dataset": context["dataset"],
            "selected_variables": selected_variables,
            "variable_candidates": candidates,
            "nodes": nodes,
            "edges": edges,
            "graph_state": DecisionGraphService._build_graph_state(
                payload=payload,
                graph_mode=graph_mode,
                selected_variables=selected_variables,
                edges=edges,
            ),
            "data_sufficiency": graph_sufficiency,
            "limitations": limitations,
            "reliability_labels": {
                "coverage": {
                    "relationship_type": "evidence_coverage",
                    "evidence_basis": "ranked_diagnostic_coverage",
                    "causal_status": "not_causal_claim",
                },
                "observed_association": {
                    "relationship_type": "observed_association",
                    "evidence_basis": "dataset_observed_association",
                    "causal_status": "not_causal_claim",
                },
                "user_hypothesis": {
                    "relationship_type": "user_hypothesis",
                    "evidence_basis": "user_stated_hypothesis",
                    "causal_status": "user_hypothesis_not_validated",
                },
            },
            "available_graph_actions": DecisionGraphService._available_graph_actions(),
            "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def plan_graph_action(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        action_id = DecisionGraphService._normalize_graph_action(payload.get("action_id") or payload.get("actionId"))
        graph = payload.get("decision_graph") or payload.get("decisionGraph") or payload.get("graph") or {}
        graph = graph if isinstance(graph, dict) else {}
        edge = DecisionGraphService._resolve_action_edge(payload, graph)
        node = DecisionGraphService._resolve_action_node(payload, graph)
        if edge is None and node is None:
            raise DecisionServiceError("Graph action requests require target_edge, target_node, or a resolvable edge_id/node_id.")

        target = DecisionGraphService._action_target(edge=edge, node=node, graph=graph)
        action = DecisionGraphService._build_graph_action(action_id, edge=edge, node=node, graph=graph, payload=payload)
        return {
            "status": "success",
            "contract_version": DecisionGraphService.CONTRACT_VERSION,
            "type": "decision_graph_action_response",
            "render_hint": "decision_graph_action_response",
            "schema_version": DecisionGraphService.CONTRACT_VERSION,
            "action_id": action_id,
            "action_status": action["action_status"],
            "enabled": action.get("enabled", action.get("action_status") == "ready"),
            "disabled_reason": action.get("disabled_reason"),
            "target": target,
            "source_refs": DecisionGraphService._graph_action_source_refs(edge=edge, node=node, target=target),
            "summary": action["summary"],
            "request_payload": action["request_payload"],
            "response_semantics": action["response_semantics"],
            "explanation": action["explanation"],
            "limitations": action["limitations"],
            "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
        }

    @staticmethod
    def _resolve_context(payload: Dict[str, Any]) -> Dict[str, Any]:
        return resolve_decision_context(
            dataset=payload.get("dataset"),
            dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
            semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
            source="decision_graph",
        )

    @staticmethod
    def _normalize_graph_mode(value: Any) -> str:
        graph_mode = str(value or DecisionGraphService.DEFAULT_MODE).strip().lower()
        if graph_mode not in DecisionGraphService.GRAPH_MODES:
            raise DecisionServiceError(
                "graph_mode must be one of evidence_coverage, observed_association, or mixed."
            )
        return graph_mode

    @staticmethod
    def _build_variable_candidates(context: Dict[str, Any]) -> List[Dict[str, Any]]:
        dataframe = context["dataframe"]
        candidates: List[Dict[str, Any]] = []
        for metric in context.get("metrics") or []:
            if not isinstance(metric, dict):
                continue
            metric_ref = build_metric_ref(metric)
            if not metric_ref:
                continue
            field_status, fields = DecisionGraphService._metric_field_status(metric, dataframe)
            candidates.append({
                "variable_id": metric_ref["metric_id"],
                "variable_type": "metric",
                "label": metric_ref.get("label") or metric_ref.get("name") or metric_ref["metric_id"],
                "field": metric_ref.get("field"),
                "ref": metric_ref,
                "eligible": field_status == "available",
                "data_type": "numeric",
                "semantic_role": DecisionGraphService._metric_role(metric_ref),
                "data_sufficiency": DecisionGraphService._candidate_sufficiency(dataframe, fields, field_status),
                "limitations": [] if field_status == "available" else ["Metric backing fields are not fully available."],
            })

        for dimension in context.get("dimensions") or []:
            if not isinstance(dimension, dict):
                continue
            dimension_ref = build_dimension_ref(dimension)
            if not dimension_ref:
                continue
            field = dimension_ref.get("field")
            field_status = "available" if field in dataframe.columns else "missing"
            candidates.append({
                "variable_id": dimension_ref["dimension_id"],
                "variable_type": "dimension",
                "label": dimension_ref.get("label") or dimension_ref.get("name") or dimension_ref["dimension_id"],
                "field": field,
                "ref": dimension_ref,
                "eligible": field_status == "available",
                "data_type": DecisionGraphService._dimension_data_type(dimension_ref, dataframe),
                "semantic_role": DecisionGraphService._dimension_role(dimension_ref),
                "data_sufficiency": DecisionGraphService._candidate_sufficiency(dataframe, [field], field_status),
                "limitations": [] if field_status == "available" else ["Dimension backing field is not available."],
            })

        return candidates

    @staticmethod
    def _metric_field_status(metric: Dict[str, Any], dataframe: pd.DataFrame) -> Tuple[str, List[str]]:
        expression = metric.get("expression") if isinstance(metric.get("expression"), dict) else {}
        field = expression.get("column") or metric.get("field")
        if field:
            return ("available" if field in dataframe.columns else "missing", [field])
        columns = expression.get("columns") if isinstance(expression.get("columns"), list) else []
        if columns:
            missing = [column for column in columns if column not in dataframe.columns]
            return ("missing" if missing else "available", list(columns))
        if expression.get("type") == "count_rows":
            return "available", []
        return "missing", []

    @staticmethod
    def _candidate_sufficiency(dataframe: pd.DataFrame, fields: Sequence[Any], field_status: str) -> Dict[str, Any]:
        if field_status != "available":
            return {
                "status": "insufficient",
                "row_count": int(len(dataframe.index)),
                "non_null_count": 0,
                "missing_count": int(len(dataframe.index)),
                "summary": "The selected variable cannot be inspected because its backing field is unavailable.",
            }
        if not fields:
            row_count = int(len(dataframe.index))
            return {
                "status": "sufficient" if row_count >= DecisionGraphService.SUFFICIENT_PAIR_SAMPLE_SIZE else "limited",
                "row_count": row_count,
                "non_null_count": row_count,
                "missing_count": 0,
                "summary": "Row-count metric can be inspected from the dataset grain.",
            }
        first_field = fields[0]
        series = dataframe[first_field] if first_field in dataframe.columns else pd.Series([], dtype="float64")
        non_null_count = int(series.notna().sum())
        status = DecisionGraphService._sufficiency_status(non_null_count)
        return {
            "status": status,
            "row_count": int(len(dataframe.index)),
            "non_null_count": non_null_count,
            "missing_count": int(len(dataframe.index) - non_null_count),
            "summary": DecisionGraphService._sufficiency_summary(status),
        }

    @staticmethod
    def _resolve_selected_variables(
        payload: Dict[str, Any],
        candidate_map: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        selected_ids: List[str] = []
        raw = payload.get("selected_variables") or payload.get("selectedVariables") or {}
        if isinstance(raw, dict):
            for key in ("metric_ids", "metricIds"):
                selected_ids.extend(str(item).strip() for item in raw.get(key) or [] if str(item).strip())
            for key in ("dimension_ids", "dimensionIds"):
                selected_ids.extend(str(item).strip() for item in raw.get(key) or [] if str(item).strip())
            for item in raw.get("variables") or []:
                if isinstance(item, dict):
                    selected_ids.append(str(item.get("variable_id") or item.get("id") or "").strip())
        elif isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict):
                    selected_ids.append(str(item.get("variable_id") or item.get("id") or "").strip())
                else:
                    selected_ids.append(str(item).strip())

        selected: List[Dict[str, Any]] = []
        seen = set()
        for variable_id in selected_ids:
            if not variable_id or variable_id in seen:
                continue
            seen.add(variable_id)
            candidate = candidate_map.get(variable_id)
            if candidate is None:
                selected.append({
                    "variable_id": variable_id,
                    "variable_type": "unknown",
                    "label": variable_id,
                    "field": None,
                    "ref": None,
                    "eligible": False,
                    "data_type": "unknown",
                    "semantic_role": "unknown",
                    "data_sufficiency": {
                        "status": "insufficient",
                        "row_count": 0,
                        "non_null_count": 0,
                        "missing_count": 0,
                        "summary": "Selected variable was not found in graph candidates.",
                    },
                    "limitations": ["Selected variable is not available in the current semantic model."],
                })
            else:
                selected.append(deepcopy(candidate))
        return selected

    @staticmethod
    def _build_variable_nodes(selected_variables: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
        nodes: List[Dict[str, Any]] = []
        for variable in selected_variables:
            node_id = DecisionGraphService._variable_node_id(variable)
            nodes.append({
                "node_id": node_id,
                "node_type": variable.get("variable_type"),
                "variable_id": variable.get("variable_id"),
                "label": variable.get("label"),
                "summary": f"{variable.get('label')} selected for graph inspection.",
                "field": variable.get("field"),
                "ref": deepcopy(variable.get("ref")),
                "data_type": variable.get("data_type"),
                "semantic_role": variable.get("semantic_role"),
                "data_sufficiency": deepcopy(variable.get("data_sufficiency") or {}),
                "limitations": list(variable.get("limitations") or []),
            })
        return nodes

    @staticmethod
    def _resolve_selected_evidence_items(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        evidence_board = payload.get("evidence_board") or payload.get("evidenceBoard")
        decision_output = payload.get("decision_output") or payload.get("decisionOutput")
        if not isinstance(evidence_board, dict) and isinstance(decision_output, dict):
            evidence_board = decision_output.get("evidence_board")
        if not isinstance(evidence_board, dict):
            return []

        items = [item for item in evidence_board.get("items") or [] if isinstance(item, dict)]
        raw_ids = payload.get("selected_evidence_ids") or payload.get("selectedEvidenceIds")
        if raw_ids is None:
            raw_ids = payload.get("evidence_ids") or payload.get("evidenceIds")
        selected_ids = {str(item).strip() for item in raw_ids or [] if str(item).strip()} if isinstance(raw_ids, list) else set()
        if not selected_ids:
            return items
        return [
            item for item in items
            if str(item.get("source_diagnostic_id") or item.get("evidence_id") or item.get("rank")).strip() in selected_ids
        ]

    @staticmethod
    def _build_evidence_coverage(
        *,
        payload: Dict[str, Any],
        selected_variables: Sequence[Dict[str, Any]],
        evidence_items: Sequence[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        selected_by_id = {str(variable.get("variable_id")): variable for variable in selected_variables}
        selected_node_ids = {
            str(variable.get("variable_id")): DecisionGraphService._variable_node_id(variable)
            for variable in selected_variables
        }
        frame_refs = DecisionGraphService._frame_variable_refs(payload)
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        for index, item in enumerate(evidence_items, start=1):
            evidence_id = str(item.get("source_diagnostic_id") or item.get("evidence_id") or f"evidence_{index}")
            evidence_node_id = f"evidence_{make_identifier('', evidence_id).strip('_')}"
            nodes.append({
                "node_id": evidence_node_id,
                "node_type": "evidence",
                "evidence_id": evidence_id,
                "label": item.get("title") or f"Evidence {item.get('rank') or index}",
                "summary": item.get("summary"),
                "strength": item.get("strength") or "insufficient",
                "data_sufficiency": deepcopy(item.get("data_sufficiency") or {}),
                "limitations": list(item.get("limitations") or []),
            })

            covered_ids = DecisionGraphService._covered_variable_ids(item, frame_refs, selected_by_id)
            for variable_id in covered_ids:
                if variable_id not in selected_node_ids:
                    continue
                variable = selected_by_id[variable_id]
                edge_id = make_identifier("edge", evidence_id, "covers", variable_id)
                data_sufficiency = deepcopy(item.get("data_sufficiency") or {})
                data_sufficiency.setdefault("status", item.get("strength") or "insufficient")
                data_sufficiency.setdefault("summary", DecisionGraphService._sufficiency_summary(data_sufficiency["status"]))
                edges.append({
                    "edge_id": edge_id,
                    "source_node_id": evidence_node_id,
                    "target_node_id": selected_node_ids[variable_id],
                    "relationship_type": "evidence_coverage",
                    "evidence_basis": "ranked_diagnostic_coverage",
                    "causal_status": "not_causal_claim",
                    "reliability_label": DecisionGraphService._reliability_label(data_sufficiency.get("status")),
                    "label": f"Evidence covers {variable.get('label')}",
                    "summary": "Ranked diagnostic evidence covers this selected decision variable.",
                    "metrics": {
                        "evidence_strength": item.get("strength") or "insufficient",
                        "source_diagnostic_id": item.get("source_diagnostic_id"),
                    },
                    "data_sufficiency": data_sufficiency,
                    "limitations": DecisionGraphService._edge_limitations(item.get("limitations")),
                })

        return nodes, edges

    @staticmethod
    def _frame_variable_refs(payload: Dict[str, Any]) -> Dict[str, List[str]]:
        decision_output = payload.get("decision_output") or payload.get("decisionOutput")
        frame = payload.get("frame")
        if not isinstance(frame, dict) and isinstance(decision_output, dict):
            frame = decision_output.get("frame")
        if not isinstance(frame, dict):
            workspace = payload.get("workspace") or payload.get("decision_workspace") or payload.get("decisionWorkspace")
            if isinstance(workspace, dict):
                scope = workspace.get("decision_scope") if isinstance(workspace.get("decision_scope"), dict) else {}
                frame = {
                    "goal": scope.get("objective"),
                    "drivers": scope.get("levers"),
                    "limits": scope.get("constraints"),
                    "breakdowns": scope.get("segment_dimensions"),
                }
        frame = frame if isinstance(frame, dict) else {}
        return {
            "goal": DecisionGraphService._ids_from_role_item(frame.get("goal")),
            "drivers": DecisionGraphService._ids_from_role_items(frame.get("drivers")),
            "limits": DecisionGraphService._ids_from_role_items(frame.get("limits")),
            "breakdowns": DecisionGraphService._ids_from_role_items(frame.get("breakdowns")),
        }

    @staticmethod
    def _covered_variable_ids(
        item: Dict[str, Any],
        frame_refs: Dict[str, List[str]],
        selected_by_id: Dict[str, Dict[str, Any]],
    ) -> List[str]:
        covers = item.get("covers") if isinstance(item.get("covers"), dict) else {}
        covered: List[str] = []
        if covers.get("goal"):
            covered.extend(frame_refs.get("goal") or [])
        covered.extend(
            DecisionGraphService._covered_ids_for_role(covers.get("drivers"), frame_refs.get("drivers"), selected_by_id)
        )
        covered.extend(
            DecisionGraphService._covered_ids_for_role(covers.get("limits"), frame_refs.get("limits"), selected_by_id)
        )
        covered.extend(
            DecisionGraphService._covered_ids_for_role(covers.get("breakdowns"), frame_refs.get("breakdowns"), selected_by_id)
        )
        if covers.get("temporal"):
            covered.extend(
                variable_id for variable_id, variable in selected_by_id.items()
                if variable.get("variable_type") == "dimension" and variable.get("data_type") == "temporal"
            )
        return DecisionGraphService._dedupe([item for item in covered if item in selected_by_id])

    @staticmethod
    def _build_observed_associations(
        context: Dict[str, Any],
        selected_variables: Sequence[Dict[str, Any]],
        payload: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        filters = payload.get("filters") or []
        dataframe = MetricResolver._apply_filters(
            context["dataframe"],
            MetricResolver._normalize_filters(filters, context["semantic_model"], context["dataframe"]),
        )
        edges: List[Dict[str, Any]] = []
        eligible = [variable for variable in selected_variables if variable.get("eligible")]
        for left_index, left in enumerate(eligible):
            for right in eligible[left_index + 1:]:
                edge = DecisionGraphService._association_edge(dataframe, left, right)
                if edge is not None:
                    edges.append(edge)
        return edges

    @staticmethod
    def _association_edge(dataframe: pd.DataFrame, left: Dict[str, Any], right: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        pair_type = f"{left.get('variable_type')}_to_{right.get('variable_type')}"
        if left.get("variable_type") == "metric" and right.get("variable_type") == "metric":
            metrics = DecisionGraphService._numeric_numeric_metrics(dataframe, left, right)
        elif left.get("variable_type") == "dimension" and right.get("variable_type") == "metric":
            metrics = (
                DecisionGraphService._temporal_numeric_metrics(dataframe, left, right)
                if left.get("data_type") == "temporal"
                else DecisionGraphService._categorical_numeric_metrics(dataframe, left, right)
            )
        elif left.get("variable_type") == "metric" and right.get("variable_type") == "dimension":
            metrics = (
                DecisionGraphService._temporal_numeric_metrics(dataframe, right, left)
                if right.get("data_type") == "temporal"
                else DecisionGraphService._categorical_numeric_metrics(dataframe, right, left)
            )
            pair_type = "dimension_to_metric"
        elif left.get("variable_type") == "dimension" and right.get("variable_type") == "dimension":
            metrics = DecisionGraphService._categorical_categorical_metrics(dataframe, left, right)
        else:
            return None

        if metrics is None:
            return None
        source_node_id = DecisionGraphService._variable_node_id(left)
        target_node_id = DecisionGraphService._variable_node_id(right)
        sufficiency = metrics.pop("data_sufficiency")
        label = f"{left.get('label')} and {right.get('label')}"
        return {
            "edge_id": make_identifier("edge", left.get("variable_id"), "observed", right.get("variable_id")),
            "source_node_id": source_node_id,
            "target_node_id": target_node_id,
            "relationship_type": "observed_association",
            "evidence_basis": "dataset_observed_association",
            "causal_status": "not_causal_claim",
            "reliability_label": DecisionGraphService._reliability_label(sufficiency.get("status")),
            "label": label,
            "summary": "The current dataset contains a descriptive association for this selected variable pair.",
            "metrics": {
                **metrics,
                "variable_pair_type": pair_type,
                "source_variable_id": left.get("variable_id"),
                "target_variable_id": right.get("variable_id"),
            },
            "data_sufficiency": sufficiency,
            "limitations": DecisionGraphService._edge_limitations([
                "Association metrics depend on observed rows available after filters and missing-value handling."
            ]),
        }

    @staticmethod
    def _build_user_hypothesis_edges(
        *,
        payload: Dict[str, Any],
        selected_variables: Sequence[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        raw_items = (
            payload.get("user_hypotheses")
            or payload.get("userHypotheses")
            or payload.get("hypothesis_edges")
            or payload.get("hypothesisEdges")
            or []
        )
        if not isinstance(raw_items, list):
            raise DecisionServiceError("user_hypotheses must be an array when provided.")

        selected_by_id = {str(variable.get("variable_id")): variable for variable in selected_variables}
        node_by_id = {
            str(variable.get("variable_id")): DecisionGraphService._variable_node_id(variable)
            for variable in selected_variables
        }
        edges: List[Dict[str, Any]] = []
        limitations: List[str] = []
        for index, item in enumerate(raw_items, start=1):
            if not isinstance(item, dict):
                limitations.append("A user hypothesis edge was ignored because it was not an object.")
                continue
            source_id = DecisionGraphService._hypothesis_variable_id(item, "source")
            target_id = DecisionGraphService._hypothesis_variable_id(item, "target")
            if not source_id or not target_id:
                limitations.append("A user hypothesis edge was ignored because source and target variables are required.")
                continue
            if source_id == target_id:
                limitations.append(f"User hypothesis '{source_id}' was ignored because source and target are the same variable.")
                continue
            source = selected_by_id.get(source_id)
            target = selected_by_id.get(target_id)
            if source is None or target is None:
                limitations.append(
                    f"User hypothesis '{source_id} -> {target_id}' was ignored because both endpoints must be selected graph variables."
                )
                continue

            edge_id = str(item.get("hypothesis_id") or item.get("hypothesisId") or "").strip()
            if not edge_id:
                edge_id = make_identifier("edge", "hypothesis", source_id, target_id, index)
            sufficiency = DecisionGraphService._hypothesis_sufficiency(source, target)
            label = str(item.get("label") or "").strip() or f"Hypothesis: {source.get('label')} -> {target.get('label')}"
            summary = str(item.get("summary") or "").strip() or (
                "User-stated directional hypothesis. The backend has not validated this relationship as causal or observational."
            )
            edges.append({
                "edge_id": edge_id,
                "source_node_id": node_by_id[source_id],
                "target_node_id": node_by_id[target_id],
                "relationship_type": "user_hypothesis",
                "evidence_basis": "user_stated_hypothesis",
                "causal_status": "user_hypothesis_not_validated",
                "reliability_label": "user_hypothesis_unvalidated",
                "label": label,
                "summary": summary,
                "metrics": {
                    "method": "user_stated_hypothesis",
                    "direction": "user_proposed_directional",
                    "validation_status": "not_validated",
                    "source_variable_id": source_id,
                    "target_variable_id": target_id,
                    "rationale": str(item.get("rationale") or item.get("reason") or "").strip() or None,
                },
                "data_sufficiency": sufficiency,
                "limitations": DecisionGraphService._edge_limitations([
                    "User hypotheses are assumptions for follow-up inspection and are not validated causal claims.",
                    "Use observed associations, evidence explanations, or missing-data checks before treating this as supported.",
                ]),
            })
        return edges, limitations

    @staticmethod
    def _hypothesis_variable_id(item: Dict[str, Any], side: str) -> str:
        snake = f"{side}_variable_id"
        camel = f"{side}VariableId"
        node_snake = f"{side}_node_id"
        node_camel = f"{side}NodeId"
        value = item.get(snake) or item.get(camel) or item.get(side)
        if not value:
            value = DecisionGraphService._variable_id_from_node_id(item.get(node_snake) or item.get(node_camel))
        return str(value or "").strip()

    @staticmethod
    def _variable_id_from_node_id(value: Any) -> str:
        text = str(value or "").strip()
        for prefix in ("node_metric_", "node_dimension_"):
            if text.startswith(prefix):
                return text[len(prefix):]
        return text

    @staticmethod
    def _hypothesis_sufficiency(source: Dict[str, Any], target: Dict[str, Any]) -> Dict[str, Any]:
        source_status = str((source.get("data_sufficiency") or {}).get("status") or "insufficient")
        target_status = str((target.get("data_sufficiency") or {}).get("status") or "insufficient")
        statuses = {source_status, target_status}
        if "insufficient" in statuses:
            status = "insufficient"
        elif "limited" in statuses:
            status = "limited"
        else:
            status = "limited"
        row_count = max(
            int((source.get("data_sufficiency") or {}).get("row_count") or 0),
            int((target.get("data_sufficiency") or {}).get("row_count") or 0),
        )
        return {
            "status": status,
            "row_count": row_count,
            "validation_status": "not_validated",
            "summary": (
                "Both variables are present enough for follow-up observational inspection, but the user hypothesis itself is not validated."
                if status != "insufficient"
                else "The user hypothesis cannot be inspected until both endpoint variables have enough usable data."
            ),
        }

    @staticmethod
    def _available_graph_actions() -> List[Dict[str, Any]]:
        return [
            {
                "action_id": "breakdown",
                "label": "Break down",
                "description": "Prepare a metric-by-dimension follow-up request when the selected graph target has both roles.",
                "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
            },
            {
                "action_id": "monitor",
                "label": "Monitor",
                "description": "Prepare a monitoring specification for selected metrics or relationships.",
                "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
            },
            {
                "action_id": "explain_evidence",
                "label": "Explain evidence",
                "description": "Explain the observed evidence and reliability boundary for the selected graph item.",
                "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
            },
            {
                "action_id": "explain_missing_data",
                "label": "Explain missing data",
                "description": "Explain missing fields, low sample size, and other inspection blockers.",
                "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
            },
            {
                "action_id": "send_to_scenario_compare",
                "label": "Send to Scenario Compare",
                "description": "Prepare a bounded direct-adjustment Scenario Compare request only when a metric target is available.",
                "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
            },
        ]

    @staticmethod
    def _followup_actions_for_edge(edge: Dict[str, Any]) -> List[Dict[str, Any]]:
        relationship_type = edge.get("relationship_type")
        has_metric = bool(DecisionGraphService._edge_metric_ids(edge))
        source_refs = DecisionGraphService._edge_source_refs(edge)
        limitations = DecisionGraphService._dedupe(
            list(edge.get("limitations") or [])
            + ["Graph follow-up actions prepare user-approved next checks; they do not execute autonomous decisions."]
        )
        return [
            DecisionGraphService._graph_followup_action(
                action_id="breakdown",
                enabled=has_metric,
                status="ready" if has_metric else "needs_metric",
                source_refs=source_refs,
                limitations=limitations,
                disabled_reason=None if has_metric else "Breakdown needs an observed metric target on the selected graph edge.",
            ),
            DecisionGraphService._graph_followup_action(
                action_id="monitor",
                enabled=has_metric,
                status="ready" if has_metric else "needs_metric",
                source_refs=source_refs,
                limitations=limitations,
                disabled_reason=None if has_metric else "Monitoring needs an observed metric target on the selected graph edge.",
            ),
            DecisionGraphService._graph_followup_action(
                action_id="explain_evidence",
                enabled=True,
                status="ready",
                source_refs=source_refs,
                limitations=limitations,
            ),
            DecisionGraphService._graph_followup_action(
                action_id="explain_missing_data",
                enabled=True,
                status="ready",
                source_refs=source_refs,
                limitations=limitations,
            ),
            DecisionGraphService._graph_followup_action(
                action_id="send_to_scenario_compare",
                enabled=has_metric and relationship_type != "user_hypothesis",
                status="ready" if has_metric and relationship_type != "user_hypothesis" else "needs_observed_metric_edge",
                source_refs=source_refs,
                limitations=limitations,
                disabled_reason=DecisionGraphService._scenario_followup_disabled_reason(
                    has_metric=has_metric,
                    relationship_type=relationship_type,
                ),
            ),
        ]

    @staticmethod
    def _graph_followup_action(
        *,
        action_id: str,
        enabled: bool,
        status: str,
        source_refs: Dict[str, Any],
        limitations: List[str],
        disabled_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        labels = {action["action_id"]: action for action in DecisionGraphService._available_graph_actions()}
        action = labels.get(action_id, {})
        item = {
            "action_id": action_id,
            "label": action.get("label") or action_id.replace("_", " ").title(),
            "description": action.get("description") or "Prepare a graph follow-up check.",
            "enabled": bool(enabled),
            "status": status,
            "source_refs": deepcopy(source_refs),
            "limitations": list(limitations or []),
            "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
        }
        if not enabled:
            item["disabled_reason"] = disabled_reason or "This graph follow-up action is not available for the selected item."
        return item

    @staticmethod
    def _edge_source_refs(edge: Dict[str, Any]) -> Dict[str, Any]:
        metrics = edge.get("metrics") if isinstance(edge.get("metrics"), dict) else {}
        return {
            "source": "decision_graph.edges",
            "edge_id": edge.get("edge_id"),
            "relationship_type": edge.get("relationship_type"),
            "evidence_basis": edge.get("evidence_basis"),
            "source_node_id": edge.get("source_node_id"),
            "target_node_id": edge.get("target_node_id"),
            "source_variable_id": metrics.get("source_variable_id"),
            "target_variable_id": metrics.get("target_variable_id"),
        }

    @staticmethod
    def _scenario_followup_disabled_reason(*, has_metric: bool, relationship_type: Any) -> Optional[str]:
        if has_metric and relationship_type == "user_hypothesis":
            return "Scenario Compare is disabled because user hypothesis edges are not observationally validated metric evidence."
        if not has_metric:
            return "Scenario Compare needs an observed metric target on the selected graph edge."
        return None

    @staticmethod
    def _normalize_graph_action(value: Any) -> str:
        action_id = str(value or "").strip().lower()
        aliases = {
            "break_down": "breakdown",
            "break_down_metric": "breakdown",
            "explain_missing": "explain_missing_data",
            "missing_data": "explain_missing_data",
            "scenario_compare": "send_to_scenario_compare",
            "send_to_scenario": "send_to_scenario_compare",
        }
        action_id = aliases.get(action_id, action_id)
        if action_id not in DecisionGraphService.GRAPH_ACTIONS:
            raise DecisionServiceError(
                "action_id must be one of breakdown, monitor, explain_evidence, explain_missing_data, or send_to_scenario_compare."
            )
        return action_id

    @staticmethod
    def _resolve_action_edge(payload: Dict[str, Any], graph: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        target_edge = payload.get("target_edge") or payload.get("targetEdge") or payload.get("edge")
        if isinstance(target_edge, dict):
            return deepcopy(target_edge)
        edge_id = str(payload.get("edge_id") or payload.get("edgeId") or "").strip()
        if not edge_id:
            return None
        for edge in graph.get("edges") or []:
            if isinstance(edge, dict) and str(edge.get("edge_id") or "").strip() == edge_id:
                return deepcopy(edge)
        return None

    @staticmethod
    def _resolve_action_node(payload: Dict[str, Any], graph: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        target_node = payload.get("target_node") or payload.get("targetNode") or payload.get("node")
        if isinstance(target_node, dict):
            return deepcopy(target_node)
        node_id = str(payload.get("node_id") or payload.get("nodeId") or "").strip()
        if not node_id:
            return None
        for node in graph.get("nodes") or []:
            if isinstance(node, dict) and str(node.get("node_id") or "").strip() == node_id:
                return deepcopy(node)
        return None

    @staticmethod
    def _action_target(
        *,
        edge: Optional[Dict[str, Any]],
        node: Optional[Dict[str, Any]],
        graph: Dict[str, Any],
    ) -> Dict[str, Any]:
        if edge is not None:
            variables = DecisionGraphService._variables_for_edge(edge, graph)
            return {
                "target_type": "edge",
                "edge_id": edge.get("edge_id"),
                "relationship_type": edge.get("relationship_type"),
                "causal_status": edge.get("causal_status"),
                "source_variable": variables.get("source"),
                "target_variable": variables.get("target"),
            }
        return {
            "target_type": "node",
            "node_id": node.get("node_id"),
            "node_type": node.get("node_type") or node.get("variable_type"),
            "variable_id": node.get("variable_id"),
            "label": node.get("label"),
        }

    @staticmethod
    def _graph_action_source_refs(
        *,
        edge: Optional[Dict[str, Any]],
        node: Optional[Dict[str, Any]],
        target: Dict[str, Any],
    ) -> Dict[str, Any]:
        if isinstance(edge, dict):
            refs = DecisionGraphService._edge_source_refs(edge)
            refs["target_type"] = "edge"
            return refs
        return {
            "source": "decision_graph.nodes",
            "target_type": "node",
            "node_id": node.get("node_id") if isinstance(node, dict) else target.get("node_id"),
            "node_type": (node.get("node_type") or node.get("variable_type")) if isinstance(node, dict) else target.get("node_type"),
            "variable_id": node.get("variable_id") if isinstance(node, dict) else target.get("variable_id"),
        }

    @staticmethod
    def _build_graph_action(
        action_id: str,
        *,
        edge: Optional[Dict[str, Any]],
        node: Optional[Dict[str, Any]],
        graph: Dict[str, Any],
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        variables = DecisionGraphService._variables_for_edge(edge, graph) if edge is not None else {}
        target_node = node or variables.get("target") or variables.get("source") or {}
        metric_ids = DecisionGraphService._target_metric_ids(edge=edge, node=target_node, variables=variables)
        dimension_fields = DecisionGraphService._target_dimension_fields(edge=edge, node=target_node, variables=variables)
        relationship_type = edge.get("relationship_type") if isinstance(edge, dict) else None
        limitations = DecisionGraphService._action_limitations(edge=edge, node=target_node)

        if action_id == "explain_evidence":
            return DecisionGraphService._explain_evidence_action(edge=edge, node=target_node, limitations=limitations)
        if action_id == "explain_missing_data":
            return DecisionGraphService._explain_missing_data_action(edge=edge, node=target_node, limitations=limitations)
        if action_id == "breakdown":
            return DecisionGraphService._breakdown_action(metric_ids, dimension_fields, payload, limitations)
        if action_id == "monitor":
            return DecisionGraphService._monitor_action(metric_ids, edge=edge, node=target_node, limitations=limitations)
        return DecisionGraphService._scenario_compare_action(
            metric_ids=metric_ids,
            dimension_fields=dimension_fields,
            relationship_type=relationship_type,
            payload=payload,
            limitations=limitations,
        )

    @staticmethod
    def _variables_for_edge(edge: Optional[Dict[str, Any]], graph: Dict[str, Any]) -> Dict[str, Optional[Dict[str, Any]]]:
        if not isinstance(edge, dict):
            return {"source": None, "target": None}
        nodes = {
            str(node.get("node_id")): node
            for node in graph.get("nodes") or []
            if isinstance(node, dict)
        }
        selected = {
            str(variable.get("variable_id")): variable
            for variable in graph.get("selected_variables") or graph.get("variable_candidates") or []
            if isinstance(variable, dict)
        }

        def resolve(node_id: Any, variable_id: Any) -> Optional[Dict[str, Any]]:
            node = nodes.get(str(node_id))
            if isinstance(node, dict) and node.get("variable_id"):
                return selected.get(str(node.get("variable_id"))) or node
            if variable_id:
                return selected.get(str(variable_id)) or {"variable_id": variable_id, "variable_type": "unknown", "label": variable_id}
            return None

        metrics = edge.get("metrics") if isinstance(edge.get("metrics"), dict) else {}
        return {
            "source": resolve(edge.get("source_node_id"), metrics.get("source_variable_id")),
            "target": resolve(edge.get("target_node_id"), metrics.get("target_variable_id")),
        }

    @staticmethod
    def _target_metric_ids(
        *,
        edge: Optional[Dict[str, Any]],
        node: Optional[Dict[str, Any]],
        variables: Optional[Dict[str, Optional[Dict[str, Any]]]] = None,
    ) -> List[str]:
        metric_ids = []
        for variable in [node, (variables or {}).get("source"), (variables or {}).get("target")]:
            if isinstance(variable, dict) and (variable.get("variable_type") or variable.get("node_type")) == "metric":
                metric_ids.append(variable.get("variable_id"))
        if isinstance(node, dict) and node.get("variable_type") == "metric":
            metric_ids.append(node.get("variable_id"))
        if isinstance(edge, dict):
            for key in ("source_variable_id", "target_variable_id"):
                value = (edge.get("metrics") or {}).get(key) if isinstance(edge.get("metrics"), dict) else None
                if value and str(value).startswith("metric_"):
                    metric_ids.append(value)
        return DecisionGraphService._dedupe(metric_ids)

    @staticmethod
    def _target_dimension_fields(
        *,
        edge: Optional[Dict[str, Any]],
        node: Optional[Dict[str, Any]],
        variables: Dict[str, Optional[Dict[str, Any]]],
    ) -> List[str]:
        fields = []
        for variable in [node, variables.get("source"), variables.get("target")]:
            if isinstance(variable, dict) and variable.get("variable_type") == "dimension":
                fields.append(variable.get("field") or variable.get("variable_id"))
        if isinstance(edge, dict):
            metrics = edge.get("metrics") if isinstance(edge.get("metrics"), dict) else {}
            for group in metrics.get("top_groups") or []:
                if isinstance(group, dict) and group.get("dimension_field"):
                    fields.append(group.get("dimension_field"))
        return DecisionGraphService._dedupe(fields)

    @staticmethod
    def _edge_metric_ids(edge: Dict[str, Any]) -> List[str]:
        if not isinstance(edge, dict):
            return []
        metrics = edge.get("metrics") if isinstance(edge.get("metrics"), dict) else {}
        values = [metrics.get("source_variable_id"), metrics.get("target_variable_id")]
        return DecisionGraphService._dedupe([value for value in values if str(value or "").startswith("metric_")])

    @staticmethod
    def _action_limitations(
        *,
        edge: Optional[Dict[str, Any]],
        node: Optional[Dict[str, Any]],
    ) -> List[str]:
        limitations = []
        if isinstance(edge, dict):
            limitations.extend(edge.get("limitations") or [])
            if edge.get("relationship_type") == "user_hypothesis":
                limitations.append("User hypothesis edges must be validated observationally before downstream comparison work.")
        if isinstance(node, dict):
            limitations.extend(node.get("limitations") or [])
        limitations.append("Graph actions prepare follow-up requests; they do not prove causality or make final decisions.")
        return DecisionGraphService._dedupe(limitations)

    @staticmethod
    def _explain_evidence_action(
        *,
        edge: Optional[Dict[str, Any]],
        node: Dict[str, Any],
        limitations: List[str],
    ) -> Dict[str, Any]:
        summary = edge.get("summary") if isinstance(edge, dict) else node.get("summary")
        return {
            "action_status": "ready",
            "summary": summary or "Evidence explanation is available for this graph target.",
            "request_payload": {
                "action_type": "explain_evidence",
                "target_edge_id": edge.get("edge_id") if isinstance(edge, dict) else None,
                "target_node_id": node.get("node_id"),
            },
            "response_semantics": {
                "result_type": "explanation",
                "executes_analysis": False,
                "causal_claim": False,
            },
            "explanation": [
                "Use the edge basis, metrics, sufficiency, and limitations to explain what evidence exists.",
                "If the target is a user hypothesis, describe it as user-stated and not validated.",
            ],
            "limitations": limitations,
        }

    @staticmethod
    def _explain_missing_data_action(
        *,
        edge: Optional[Dict[str, Any]],
        node: Dict[str, Any],
        limitations: List[str],
    ) -> Dict[str, Any]:
        sufficiency = edge.get("data_sufficiency") if isinstance(edge, dict) else node.get("data_sufficiency")
        return {
            "action_status": "ready",
            "summary": "Missing-data explanation is available from the selected graph item's sufficiency and limitation fields.",
            "request_payload": {
                "action_type": "explain_missing_data",
                "data_sufficiency": sufficiency or {},
                "limitations": limitations,
            },
            "response_semantics": {
                "result_type": "missing_data_explanation",
                "executes_analysis": False,
                "causal_claim": False,
            },
            "explanation": [
                "Report row counts, sample size, missing fields, and unresolved variables when available.",
                "Explain whether the blocker prevents observational inspection or only makes it limited.",
            ],
            "limitations": limitations,
        }

    @staticmethod
    def _breakdown_action(
        metric_ids: List[str],
        dimension_fields: List[str],
        payload: Dict[str, Any],
        limitations: List[str],
    ) -> Dict[str, Any]:
        ready = bool(metric_ids and dimension_fields)
        return {
            "action_status": "ready" if ready else "needs_input",
            "enabled": ready,
            "disabled_reason": None if ready else "Breakdown needs one metric target and one breakdown dimension.",
            "summary": (
                "A metric breakdown request can be prepared from the selected graph target."
                if ready
                else "Breakdown needs one metric and one breakdown dimension."
            ),
            "request_payload": {
                "route_hint": "/api/decision/chat/actions",
                "action": "analyze_workspace",
                "analysis_preferences": {
                    "focus": "breakdown",
                    "metric_ids": metric_ids,
                    "group_by": dimension_fields,
                    "filters": payload.get("filters") or [],
                },
            },
            "response_semantics": {
                "result_type": "observational_breakdown_request",
                "executes_analysis": False,
                "causal_claim": False,
            },
            "explanation": [
                "Use this to ask the existing workspace analysis path for a metric-by-dimension view.",
                "The result is a breakdown for inspection, not proof of a driver.",
            ],
            "limitations": limitations,
        }

    @staticmethod
    def _monitor_action(
        metric_ids: List[str],
        *,
        edge: Optional[Dict[str, Any]],
        node: Dict[str, Any],
        limitations: List[str],
    ) -> Dict[str, Any]:
        ready = bool(metric_ids)
        return {
            "action_status": "ready" if ready else "needs_metric",
            "enabled": ready,
            "disabled_reason": None if ready else "Monitoring needs at least one metric variable.",
            "summary": (
                "A monitoring specification can be prepared for the metric target."
                if ready
                else "Monitoring needs at least one metric variable."
            ),
            "request_payload": {
                "action_type": "monitor_relationship",
                "metric_ids": metric_ids,
                "edge_id": edge.get("edge_id") if isinstance(edge, dict) else None,
                "node_id": node.get("node_id"),
                "thresholds": [],
                "schedule": None,
            },
            "response_semantics": {
                "result_type": "monitoring_specification",
                "executes_analysis": False,
                "causal_claim": False,
            },
            "explanation": [
                "Monitoring tracks future observed values or relationship diagnostics.",
                "Thresholds and cadence require user approval before any automation is created.",
            ],
            "limitations": limitations,
        }

    @staticmethod
    def _scenario_compare_action(
        *,
        metric_ids: List[str],
        dimension_fields: List[str],
        relationship_type: Optional[str],
        payload: Dict[str, Any],
        limitations: List[str],
    ) -> Dict[str, Any]:
        ready = bool(metric_ids) and relationship_type != "user_hypothesis"
        status = "ready" if ready else ("needs_observed_metric_edge" if metric_ids else "needs_metric")
        disabled_reason = DecisionGraphService._scenario_followup_disabled_reason(
            has_metric=bool(metric_ids),
            relationship_type=relationship_type,
        )
        return {
            "action_status": status,
            "enabled": ready,
            "disabled_reason": None if ready else disabled_reason,
            "summary": (
                "A bounded Scenario Compare request can be prepared as a direct metric adjustment scaffold."
                if ready
                else disabled_reason or "Scenario Compare is blocked until an observed metric target is selected."
            ),
            "request_payload": {
                "route_hint": "/api/decision/scenarios/evaluate",
                "name": "Graph follow-up scenario compare",
                "metric_targets": [
                    {
                        "metric_id": metric_id,
                        "adjustment_type": "percent",
                        "adjustment_value": 0.0,
                    }
                    for metric_id in metric_ids[:1]
                ],
                "group_by": dimension_fields[:1],
                "filters": payload.get("filters") or [],
            },
            "response_semantics": {
                "result_type": "scenario_compare_request",
                "executes_analysis": False,
                "scenario_semantics": "direct_adjustment_only",
                "causal_claim": False,
            },
            "explanation": [
                "Scenario Compare uses direct adjustments on observed metric baselines.",
                "It is not a forecast, simulation, optimizer, or causal model.",
            ],
            "limitations": limitations,
        }

    @staticmethod
    def _numeric_numeric_metrics(dataframe: pd.DataFrame, left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, Any]:
        left_series = pd.to_numeric(dataframe[left.get("field")], errors="coerce")
        right_series = pd.to_numeric(dataframe[right.get("field")], errors="coerce")
        pair = pd.concat([left_series, right_series], axis=1).dropna()
        sample_size = int(len(pair.index))
        corr = float(pair.iloc[:, 0].corr(pair.iloc[:, 1])) if sample_size >= 2 else None
        if corr is not None and math.isnan(corr):
            corr = None
        abs_corr = abs(corr) if corr is not None else None
        status = DecisionGraphService._sufficiency_status(sample_size)
        return {
            "method": "pearson_correlation",
            "strength": DecisionGraphService._strength_from_value(abs_corr, status),
            "direction": DecisionGraphService._direction_from_correlation(corr),
            "correlation": rounded(corr),
            "absolute_correlation": rounded(abs_corr),
            "sample_size": sample_size,
            "missing_pair_count": int(len(dataframe.index) - sample_size),
            "data_sufficiency": {
                "status": status,
                "row_count": int(len(dataframe.index)),
                "sample_size": sample_size,
                "summary": DecisionGraphService._sufficiency_summary(status),
            },
        }

    @staticmethod
    def _categorical_numeric_metrics(
        dataframe: pd.DataFrame,
        dimension: Dict[str, Any],
        metric: Dict[str, Any],
    ) -> Dict[str, Any]:
        frame = dataframe[[dimension.get("field"), metric.get("field")]].copy()
        frame["_metric_value"] = pd.to_numeric(frame[metric.get("field")], errors="coerce")
        frame = frame.dropna(subset=[dimension.get("field"), "_metric_value"])
        sample_size = int(len(frame.index))
        grouped = frame.groupby(dimension.get("field"), dropna=False)["_metric_value"].agg(["mean", "count"]).reset_index()
        group_count = int(len(grouped.index))
        status = "insufficient"
        if sample_size >= DecisionGraphService.SUFFICIENT_PAIR_SAMPLE_SIZE and group_count >= 2:
            status = "sufficient"
        elif sample_size >= DecisionGraphService.MIN_PAIR_SAMPLE_SIZE and group_count >= 2:
            status = "limited"
        group_rows = []
        if group_count:
            grouped = grouped.sort_values("mean", ascending=False)
            group_rows = [
                {
                    "group": DecisionGraphService._serialize_value(row[dimension.get("field")]),
                    "mean_value": rounded(row["mean"]),
                    "sample_size": int(row["count"]),
                }
                for _, row in grouped.head(5).iterrows()
            ]
        top = group_rows[0] if group_rows else None
        bottom = group_rows[-1] if len(group_rows) > 1 else None
        delta = (float(top["mean_value"]) - float(bottom["mean_value"])) if top and bottom else None
        return {
            "method": "group_mean_difference",
            "strength": DecisionGraphService._group_strength(delta, bottom, status),
            "direction": "group_difference_observed" if status != "insufficient" else "not_enough_data",
            "sample_size": sample_size,
            "group_count": group_count,
            "top_groups": group_rows,
            "top_bottom_delta": rounded(delta),
            "data_sufficiency": {
                "status": status,
                "row_count": int(len(dataframe.index)),
                "sample_size": sample_size,
                "group_count": group_count,
                "summary": DecisionGraphService._sufficiency_summary(status),
            },
        }

    @staticmethod
    def _temporal_numeric_metrics(
        dataframe: pd.DataFrame,
        dimension: Dict[str, Any],
        metric: Dict[str, Any],
    ) -> Dict[str, Any]:
        frame = dataframe[[dimension.get("field"), metric.get("field")]].copy()
        frame["_period"] = pd.to_datetime(frame[dimension.get("field")], errors="coerce")
        frame["_metric_value"] = pd.to_numeric(frame[metric.get("field")], errors="coerce")
        frame = frame.dropna(subset=["_period", "_metric_value"]).sort_values("_period")
        sample_size = int(len(frame.index))
        status = DecisionGraphService._sufficiency_status(sample_size)
        trend_correlation = None
        if sample_size >= 2:
            ordinals = pd.Series(range(sample_size), index=frame.index)
            trend_correlation = float(ordinals.corr(frame["_metric_value"]))
            if math.isnan(trend_correlation):
                trend_correlation = None
        first_value = float(frame["_metric_value"].iloc[0]) if sample_size else None
        last_value = float(frame["_metric_value"].iloc[-1]) if sample_size else None
        delta = (last_value - first_value) if first_value is not None and last_value is not None else None
        return {
            "method": "observed_time_trend",
            "strength": DecisionGraphService._strength_from_value(abs(trend_correlation) if trend_correlation is not None else None, status),
            "direction": DecisionGraphService._direction_from_correlation(trend_correlation),
            "sample_size": sample_size,
            "first_value": rounded(first_value),
            "last_value": rounded(last_value),
            "delta_value": rounded(delta),
            "trend_correlation": rounded(trend_correlation),
            "data_sufficiency": {
                "status": status,
                "row_count": int(len(dataframe.index)),
                "sample_size": sample_size,
                "summary": DecisionGraphService._sufficiency_summary(status),
            },
        }

    @staticmethod
    def _categorical_categorical_metrics(dataframe: pd.DataFrame, left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, Any]:
        frame = dataframe[[left.get("field"), right.get("field")]].dropna()
        sample_size = int(len(frame.index))
        status = "sufficient" if sample_size >= 20 else ("limited" if sample_size >= DecisionGraphService.MIN_PAIR_SAMPLE_SIZE else "insufficient")
        if sample_size < DecisionGraphService.MIN_PAIR_SAMPLE_SIZE:
            cramers_v = None
            distinct_pairs = 0
        else:
            table = pd.crosstab(frame[left.get("field")], frame[right.get("field")])
            distinct_pairs = int((table > 0).sum().sum())
            cramers_v = DecisionGraphService._cramers_v(table)
        return {
            "method": "distribution_association",
            "strength": DecisionGraphService._strength_from_value(cramers_v, status),
            "direction": "distribution_difference_observed" if status != "insufficient" else "not_enough_data",
            "sample_size": sample_size,
            "distinct_pair_count": distinct_pairs,
            "cramers_v": rounded(cramers_v),
            "data_sufficiency": {
                "status": status,
                "row_count": int(len(dataframe.index)),
                "sample_size": sample_size,
                "summary": DecisionGraphService._sufficiency_summary(status),
            },
        }

    @staticmethod
    def _cramers_v(table: pd.DataFrame) -> Optional[float]:
        total = float(table.to_numpy().sum())
        if total <= 0:
            return None
        row_sums = table.sum(axis=1).to_numpy()
        col_sums = table.sum(axis=0).to_numpy()
        expected = pd.DataFrame(index=table.index, columns=table.columns)
        for row_index, row_total in enumerate(row_sums):
            for col_index, col_total in enumerate(col_sums):
                expected.iat[row_index, col_index] = (row_total * col_total) / total
        expected_numeric = expected.astype(float)
        chi_square = (
            (((table - expected_numeric) ** 2) / expected_numeric)
            .replace([math.inf, -math.inf], pd.NA)
            .fillna(0)
            .to_numpy()
            .sum()
        )
        denominator = total * max(1, min(table.shape[0] - 1, table.shape[1] - 1))
        if denominator <= 0:
            return None
        return math.sqrt(float(chi_square) / denominator)

    @staticmethod
    def _dataset_sufficiency(context: Dict[str, Any]) -> Dict[str, Any]:
        row_count = int(len(context["dataframe"].index))
        status = DecisionGraphService._sufficiency_status(row_count)
        return {
            "status": status,
            "row_count": row_count,
            "metric_candidate_count": len(context.get("metrics") or []),
            "dimension_candidate_count": len(context.get("dimensions") or []),
            "summary": DecisionGraphService._sufficiency_summary(status),
        }

    @staticmethod
    def _build_graph_state(
        *,
        payload: Dict[str, Any],
        graph_mode: str,
        selected_variables: Sequence[Dict[str, Any]],
        edges: Sequence[Dict[str, Any]],
    ) -> Dict[str, Any]:
        metric_ids = [
            variable.get("variable_id")
            for variable in selected_variables
            if variable.get("variable_type") == "metric" and variable.get("variable_id")
        ]
        dimension_ids = [
            variable.get("variable_id")
            for variable in selected_variables
            if variable.get("variable_type") == "dimension" and variable.get("variable_id")
        ]
        user_hypotheses = []
        for edge in edges:
            if not isinstance(edge, dict) or edge.get("relationship_type") != "user_hypothesis":
                continue
            metrics = edge.get("metrics") if isinstance(edge.get("metrics"), dict) else {}
            user_hypotheses.append({
                "hypothesis_id": edge.get("edge_id"),
                "source_variable_id": metrics.get("source_variable_id"),
                "target_variable_id": metrics.get("target_variable_id"),
                "label": edge.get("label"),
                "summary": edge.get("summary"),
                "rationale": metrics.get("rationale"),
                "causal_status": edge.get("causal_status"),
                "validation_status": metrics.get("validation_status"),
            })
        raw_evidence_ids = (
            payload.get("selected_evidence_ids")
            or payload.get("selectedEvidenceIds")
            or payload.get("evidence_ids")
            or payload.get("evidenceIds")
            or []
        )
        selected_evidence_ids = [
            str(item).strip()
            for item in raw_evidence_ids
            if str(item).strip()
        ] if isinstance(raw_evidence_ids, list) else []
        return {
            "schema_version": DecisionGraphService.CONTRACT_VERSION,
            "state_kind": "decision_graph_build_state",
            "persistence": "client_session_or_saved_decision_asset",
            "graph_mode": graph_mode,
            "selected_variables": {
                "metric_ids": DecisionGraphService._dedupe(metric_ids),
                "dimension_ids": DecisionGraphService._dedupe(dimension_ids),
            },
            "selected_evidence_ids": selected_evidence_ids,
            "user_hypotheses": user_hypotheses,
            "filters": deepcopy(payload.get("filters") or []),
            "truth_boundary": DecisionGraphService.TRUTH_BOUNDARY,
            "limitations": [
                "Graph state is a carry-forward payload for UI session state or saved decision assets; this endpoint does not persist it server-side."
            ],
        }

    @staticmethod
    def _graph_sufficiency(
        *,
        context: Dict[str, Any],
        selected_variables: Sequence[Dict[str, Any]],
        edges: Sequence[Dict[str, Any]],
    ) -> Dict[str, Any]:
        row_count = int(len(context["dataframe"].index))
        edge_statuses = [
            str((edge.get("data_sufficiency") or {}).get("status") or "insufficient")
            for edge in edges
            if isinstance(edge, dict)
        ]
        if not selected_variables or not edges:
            status = "insufficient"
        elif any(status == "sufficient" for status in edge_statuses):
            status = "sufficient"
        elif any(status == "limited" for status in edge_statuses):
            status = "limited"
        else:
            status = DecisionGraphService._sufficiency_status(row_count)
        return {
            "status": status,
            "row_count": row_count,
            "selected_variable_count": len(selected_variables),
            "edge_count": len(edges),
            "summary": DecisionGraphService._sufficiency_summary(status),
        }

    @staticmethod
    def _sufficiency_status(sample_size: int) -> str:
        if sample_size >= DecisionGraphService.SUFFICIENT_PAIR_SAMPLE_SIZE:
            return "sufficient"
        if sample_size >= DecisionGraphService.MIN_PAIR_SAMPLE_SIZE:
            return "limited"
        return "insufficient"

    @staticmethod
    def _sufficiency_summary(status: Any) -> str:
        normalized = str(status or "").lower()
        if normalized == "sufficient":
            return "Enough observed rows are available for a descriptive graph edge."
        if normalized == "limited":
            return "Some observed rows are available, but the edge should be reviewed cautiously."
        return "There are not enough observed rows to support a reliable graph edge."

    @staticmethod
    def _reliability_label(status: Any) -> str:
        normalized = str(status or "").lower()
        if normalized == "sufficient":
            return "observed_supported"
        if normalized == "limited":
            return "observed_limited"
        return "observed_insufficient"

    @staticmethod
    def _edge_limitations(extra: Any = None) -> List[str]:
        limitations = [str(item).strip() for item in (extra or []) if str(item).strip()] if isinstance(extra, list) else []
        limitations.append("This graph edge is descriptive only and is not a decision rule.")
        return DecisionGraphService._dedupe(limitations)

    @staticmethod
    def _strength_from_value(value: Optional[float], status: str) -> str:
        if status == "insufficient" or value is None:
            return "insufficient"
        if value >= 0.7:
            return "strong"
        if value >= 0.4:
            return "moderate"
        return "weak"

    @staticmethod
    def _direction_from_correlation(correlation: Optional[float]) -> str:
        if correlation is None:
            return "not_enough_data"
        if abs(correlation) < 0.1:
            return "no_clear_direction"
        return "positive" if correlation > 0 else "negative"

    @staticmethod
    def _group_strength(delta: Optional[float], bottom: Optional[Dict[str, Any]], status: str) -> str:
        if status == "insufficient" or delta is None or not bottom:
            return "insufficient"
        denominator = abs(float(bottom.get("mean_value") or 0))
        if denominator == 0:
            return "moderate" if abs(delta) > 0 else "weak"
        ratio = abs(delta) / denominator
        if ratio >= 0.5:
            return "strong"
        if ratio >= 0.2:
            return "moderate"
        return "weak"

    @staticmethod
    def _metric_role(metric_ref: Dict[str, Any]) -> str:
        semantics = metric_ref.get("decision_semantics") if isinstance(metric_ref.get("decision_semantics"), dict) else {}
        if semantics.get("objective_candidate"):
            return "objective_candidate"
        if semantics.get("lever_candidate"):
            return "driver_candidate"
        if semantics.get("guardrail_candidate"):
            return "limit_candidate"
        return "metric"

    @staticmethod
    def _dimension_role(dimension_ref: Dict[str, Any]) -> str:
        if DecisionGraphService._is_temporal_dimension(dimension_ref):
            return "temporal"
        semantics = dimension_ref.get("decision_semantics") if isinstance(dimension_ref.get("decision_semantics"), dict) else {}
        if semantics.get("segment_candidate"):
            return "breakdown_candidate"
        return "dimension"

    @staticmethod
    def _dimension_data_type(dimension_ref: Dict[str, Any], dataframe: pd.DataFrame) -> str:
        if DecisionGraphService._is_temporal_dimension(dimension_ref):
            return "temporal"
        field = dimension_ref.get("field")
        if field in dataframe.columns and pd.api.types.is_numeric_dtype(dataframe[field]):
            return "numeric_dimension"
        return "categorical"

    @staticmethod
    def _is_temporal_dimension(dimension_ref: Dict[str, Any]) -> bool:
        semantics = dimension_ref.get("decision_semantics") if isinstance(dimension_ref.get("decision_semantics"), dict) else {}
        return (
            str(dimension_ref.get("semantic_kind") or "").lower() == "temporal"
            or str(dimension_ref.get("data_type") or "").lower() in {"date", "datetime", "timestamp"}
            or bool(semantics.get("temporal_candidate"))
        )

    @staticmethod
    def _ids_from_role_items(items: Any) -> List[str]:
        if not isinstance(items, list):
            return []
        ids: List[str] = []
        for item in items:
            ids.extend(DecisionGraphService._ids_from_role_item(item))
        return DecisionGraphService._dedupe(ids)

    @staticmethod
    def _ids_from_role_item(item: Any) -> List[str]:
        if not isinstance(item, dict):
            return []
        ids = [
            item.get("metric_id"),
            item.get("dimension_id"),
            (item.get("metric_ref") or {}).get("metric_id") if isinstance(item.get("metric_ref"), dict) else None,
            (item.get("dimension_ref") or {}).get("dimension_id") if isinstance(item.get("dimension_ref"), dict) else None,
        ]
        binding = item.get("binding") if isinstance(item.get("binding"), dict) else {}
        metric_ref = binding.get("metric_ref") if isinstance(binding.get("metric_ref"), dict) else {}
        dimension_ref = binding.get("dimension_ref") if isinstance(binding.get("dimension_ref"), dict) else {}
        ids.extend([
            binding.get("metric_id"),
            binding.get("dimension_id"),
            metric_ref.get("metric_id"),
            dimension_ref.get("dimension_id"),
        ])
        return [str(value).strip() for value in ids if value is not None and str(value).strip()]

    @staticmethod
    def _covered_ids_for_role(
        role_items: Any,
        frame_ids: Optional[List[str]],
        selected_by_id: Dict[str, Dict[str, Any]],
    ) -> List[str]:
        if isinstance(role_items, bool):
            return list(frame_ids or []) if role_items else []
        role_ids = DecisionGraphService._ids_from_role_items(role_items)
        if role_ids:
            return role_ids
        if not isinstance(role_items, list):
            return []
        selected_by_label = {
            str(variable.get("label") or "").strip().lower(): variable_id
            for variable_id, variable in selected_by_id.items()
            if str(variable.get("label") or "").strip()
        }
        matched: List[str] = []
        for item in role_items:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or item.get("name") or "").strip().lower()
            if label in selected_by_label:
                matched.append(selected_by_label[label])
        return DecisionGraphService._dedupe(matched)

    @staticmethod
    def _variable_node_id(variable: Dict[str, Any]) -> str:
        return make_identifier("node", variable.get("variable_type"), variable.get("variable_id"))

    @staticmethod
    def _dedupe(values: Sequence[str]) -> List[str]:
        seen = set()
        deduped: List[str] = []
        for value in values:
            text = str(value or "").strip()
            if not text or text in seen:
                continue
            seen.add(text)
            deduped.append(text)
        return deduped

    @staticmethod
    def _serialize_value(value: Any) -> Any:
        if value is None:
            return None
        try:
            if pd.isna(value):
                return None
        except Exception:
            pass
        if hasattr(value, "item"):
            try:
                return value.item()
            except Exception:
                return value
        return value
