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

    CONTRACT_VERSION = "di_phase7_1_decision_graph_v1"
    TRUTH_BOUNDARY = "observational_analysis_only"
    DEFAULT_MODE = "mixed"
    GRAPH_MODES = {"evidence_coverage", "observed_association", "mixed"}
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
            },
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
            },
            "data_sufficiency": sufficiency,
            "limitations": DecisionGraphService._edge_limitations([
                "Association metrics depend on observed rows available after filters and missing-value handling."
            ]),
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
