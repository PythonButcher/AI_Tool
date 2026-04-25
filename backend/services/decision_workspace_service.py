from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

import pandas as pd

from backend.services.decision_signal_service import generate_decision_signals
from backend.services.decision_support import (
    DecisionServiceError,
    build_dimension_ref,
    build_metric_ref,
    build_period_context,
    build_semantic_summary,
    build_time_context,
    describe_period_window,
    iso_timestamp,
    latest_metric_change,
    make_identifier,
    normalize_filters,
    resolve_decision_context,
    select_breakdown_dimensions,
)
from backend.services.metric_resolver import MetricResolver, MetricResolutionError


class DecisionWorkspaceService:
    """
    DecisionWorkspaceService (DI 2.0)

    Creates contract-faithful scoped decision workspaces without falling back
    to the old ranked broad-scan model as the primary DI 2.0 response.
    """

    DEFAULT_MAX_METRICS = 8
    DEFAULT_MAX_DIMENSIONS = 6
    MAX_METRICS = 20
    MAX_DIMENSIONS = 12
    DEFAULT_MAX_SECONDARY_SIGNALS = 3
    MAX_SECONDARY_SIGNALS = 6
    PROMPT_MATCH_STOPWORDS = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "how",
        "in",
        "into",
        "is",
        "it",
        "of",
        "on",
        "or",
        "our",
        "should",
        "the",
        "this",
        "to",
        "we",
        "what",
        "which",
        "while",
        "with",
        "without",
    }
    GENERIC_METRIC_TOKENS = {
        "amount",
        "average",
        "count",
        "index",
        "metric",
        "number",
        "pct",
        "percent",
        "percentage",
        "rate",
        "ratio",
        "score",
        "total",
        "value",
    }

    @staticmethod
    def create_workspace(payload: Dict[str, Any]) -> Dict[str, Any]:
        workspace_artifacts = DecisionWorkspaceService._build_workspace_artifacts(payload)
        context = workspace_artifacts["context"]
        workspace = workspace_artifacts["workspace"]
        generated_at = workspace_artifacts["generated_at"]
        scoped_context = workspace["scoped_context"]
        unknowns = workspace["unknowns"]

        return {
            "status": "success",
            "contract_version": "di_2_0_v1",
            "dataset": context["dataset"],
            "semantic_model": build_semantic_summary(context["semantic_model"]),
            "decision_workspace": workspace,
            "meta": {
                "intake_mode": ((workspace.get("drafting") or {}).get("intake_mode") or "structured"),
                "relevant_metric_count": len(scoped_context["relevant_metrics"]),
                "relevant_dimension_count": len(scoped_context["relevant_dimensions"]),
                "unknown_count": len(unknowns),
                "generated_at": generated_at,
            },
            "warnings": [],
        }

    @staticmethod
    def analyze_workspace(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        generated_at = iso_timestamp()
        context = resolve_decision_context(
            dataset=payload.get("dataset"),
            dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
            semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
            source="decision_workspace_analysis",
        )
        workspace = DecisionWorkspaceService._resolve_workspace_for_analysis(payload, context)
        analysis_preferences = DecisionWorkspaceService._normalize_analysis_preferences(
            payload.get("analysis_preferences")
        )
        workspace_analysis, warnings = DecisionWorkspaceService._build_workspace_analysis(
            payload=payload,
            context=context,
            workspace=workspace,
            analysis_preferences=analysis_preferences,
            generated_at=generated_at,
        )

        return {
            "status": "success",
            "contract_version": "di_2_0_v1",
            "dataset": context["dataset"],
            "semantic_model": build_semantic_summary(context["semantic_model"]),
            "decision_workspace": workspace,
            "workspace_analysis": workspace_analysis,
            "meta": {
                "intake_mode": ((workspace.get("drafting") or {}).get("intake_mode") or "structured"),
                "relevant_metric_count": len(workspace["scoped_context"]["relevant_metrics"]),
                "relevant_dimension_count": len(workspace["scoped_context"]["relevant_dimensions"]),
                "unknown_count": len(workspace["unknowns"]),
                "scoped_diagnostic_count": len(workspace_analysis["scoped_diagnostics"]),
                "secondary_legacy_signal_count": len(workspace_analysis["legacy_diagnostics"]["signals"]),
                "generated_at": generated_at,
            },
            "warnings": warnings,
        }

    @staticmethod
    def _build_workspace_artifacts(
        payload: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        generated_at = iso_timestamp()
        resolved_context = context or resolve_decision_context(
            dataset=payload.get("dataset"),
            dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
            semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
            source="decision_workspace",
        )

        decision_prompt = str(payload.get("decision_prompt") or "").strip()
        if not decision_prompt:
            raise DecisionServiceError("decision_prompt is required to create a workspace.")

        decision_intake = DecisionWorkspaceService._normalize_decision_intake(
            payload.get("decision_intake") or payload.get("decisionIntake")
        )
        intake_mode = DecisionWorkspaceService._resolve_intake_mode(payload, decision_intake)
        prompt_matches = DecisionWorkspaceService._build_prompt_matches(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
            context=resolved_context,
        )
        prompt_first_draft = DecisionWorkspaceService._build_prompt_first_draft(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
            intake_mode=intake_mode,
            prompt_matches=prompt_matches,
        )

        raw_objective = payload.get("objective")
        objective_was_user_supplied = isinstance(raw_objective, dict)
        if raw_objective is None:
            raw_objective = prompt_first_draft.get("objective")
        if not isinstance(raw_objective, dict):
            raise DecisionServiceError("objective is required to create a workspace.")

        raw_levers = payload.get("levers")
        levers_were_user_supplied = isinstance(raw_levers, list)
        if raw_levers is None:
            raw_levers = prompt_first_draft.get("levers") or []
        if not isinstance(raw_levers, list):
            raise DecisionServiceError("levers must be an array when provided.")

        raw_constraints = payload.get("constraints")
        constraints_were_user_supplied = isinstance(raw_constraints, list)
        if raw_constraints is None:
            raw_constraints = prompt_first_draft.get("constraints") or []
        if not isinstance(raw_constraints, list):
            raise DecisionServiceError("constraints must be an array when provided.")

        applied_filters = normalize_filters(payload)
        scope_preferences = DecisionWorkspaceService._normalize_scope_preferences(payload.get("scope_preferences"))
        normalized_objective = DecisionWorkspaceService._normalize_objective(raw_objective, resolved_context)
        normalized_levers = [
            DecisionWorkspaceService._normalize_lever(item, resolved_context, index)
            for index, item in enumerate(raw_levers)
        ]
        normalized_constraints = [
            DecisionWorkspaceService._normalize_constraint(item, resolved_context, index)
            for index, item in enumerate(raw_constraints)
        ]

        scoped_context = DecisionWorkspaceService._build_scoped_context(
            context=resolved_context,
            objective=normalized_objective,
            levers=normalized_levers,
            constraints=normalized_constraints,
            applied_filters=applied_filters,
            scope_preferences=scope_preferences,
        )
        assumptions = DecisionWorkspaceService._generate_assumptions(
            objective=normalized_objective,
            levers=normalized_levers,
            constraints=normalized_constraints,
            scoped_context=scoped_context,
        )
        unknowns = DecisionWorkspaceService._generate_unknowns(
            objective=normalized_objective,
            levers=normalized_levers,
            constraints=normalized_constraints,
        )
        readiness = DecisionWorkspaceService._evaluate_readiness(
            objective=normalized_objective,
            levers=normalized_levers,
            constraints=normalized_constraints,
            unknowns=unknowns,
        )
        workspace_status = DecisionWorkspaceService._derive_workspace_status(readiness)
        workspace = {
            "workspace_id": make_identifier(
                "decision_workspace",
                normalized_objective.get("objective_id") or decision_prompt[:48],
                generated_at,
            ),
            "workspace_type": "scoped_decision",
            "status": workspace_status,
            "title": DecisionWorkspaceService._generate_title(normalized_objective),
            "decision_prompt": decision_prompt,
            "dataset": resolved_context["dataset"],
            "decision_scope": {
                "objective": normalized_objective,
                "levers": normalized_levers,
                "constraints": normalized_constraints,
            },
            "scope_summary": DecisionWorkspaceService._generate_scope_summary(
                normalized_objective,
                normalized_levers,
                normalized_constraints,
            ),
            "scoped_context": scoped_context,
            "assumptions": assumptions,
            "unknowns": unknowns,
            "readiness": readiness,
            "drafting": DecisionWorkspaceService._build_drafting_summary(
                intake_mode=intake_mode,
                decision_intake=decision_intake,
                prompt_matches=prompt_matches,
                clarification_hints=prompt_first_draft.get("clarification_hints") or [],
                objective_source="user_input" if objective_was_user_supplied else "system_draft",
                levers_source="user_input" if levers_were_user_supplied else ("system_draft" if normalized_levers else "none"),
                constraints_source="user_input" if constraints_were_user_supplied else ("system_draft" if normalized_constraints else "none"),
                prompt_frame=prompt_first_draft.get("prompt_frame") or {},
            ),
            "created_at": generated_at,
        }
        return {
            "context": resolved_context,
            "workspace": workspace,
            "generated_at": generated_at,
            "scope_preferences": scope_preferences,
        }

    @staticmethod
    def _normalize_scope_preferences(raw: Any) -> Dict[str, Any]:
        raw = raw if isinstance(raw, dict) else {}
        return {
            "max_candidate_metrics": DecisionWorkspaceService._clamp_int(
                raw.get("max_candidate_metrics"),
                default=DecisionWorkspaceService.DEFAULT_MAX_METRICS,
                minimum=1,
                maximum=DecisionWorkspaceService.MAX_METRICS,
            ),
            "max_candidate_dimensions": DecisionWorkspaceService._clamp_int(
                raw.get("max_candidate_dimensions"),
                default=DecisionWorkspaceService.DEFAULT_MAX_DIMENSIONS,
                minimum=1,
                maximum=DecisionWorkspaceService.MAX_DIMENSIONS,
            ),
            "include_diagnostics": bool(raw.get("include_diagnostics", False)),
        }

    @staticmethod
    def _normalize_analysis_preferences(raw: Any) -> Dict[str, Any]:
        raw = raw if isinstance(raw, dict) else {}
        include_secondary = raw.get("include_secondary_legacy_diagnostics")
        if include_secondary is None:
            include_secondary = raw.get("include_legacy_diagnostics")
        if include_secondary is None:
            include_secondary = True
        return {
            "include_secondary_legacy_diagnostics": bool(include_secondary),
            "max_secondary_signals": DecisionWorkspaceService._clamp_int(
                raw.get("max_secondary_signals"),
                default=DecisionWorkspaceService.DEFAULT_MAX_SECONDARY_SIGNALS,
                minimum=0,
                maximum=DecisionWorkspaceService.MAX_SECONDARY_SIGNALS,
            ),
        }

    @staticmethod
    def _clamp_int(value: Any, default: int, minimum: int, maximum: int) -> int:
        if value is None:
            return default
        try:
            parsed = int(value)
        except (TypeError, ValueError) as exc:
            raise DecisionServiceError("Scope preference values must be integers.") from exc
        return max(minimum, min(maximum, parsed))

    @staticmethod
    def _normalize_decision_intake(raw: Any) -> Dict[str, Optional[str]]:
        raw = raw if isinstance(raw, dict) else {}
        return {
            "what_matters": DecisionWorkspaceService._clean_text(
                raw.get("what_matters") or raw.get("whatMatters")
            ),
            "what_to_avoid": DecisionWorkspaceService._clean_text(
                raw.get("what_to_avoid") or raw.get("whatToAvoid")
            ),
            "additional_context": DecisionWorkspaceService._clean_text(
                raw.get("additional_context") or raw.get("additionalContext")
            ),
        }

    @staticmethod
    def _resolve_intake_mode(
        payload: Dict[str, Any],
        decision_intake: Dict[str, Optional[str]],
    ) -> str:
        requested_mode = DecisionWorkspaceService._normalize_text(
            payload.get("intake_mode") or payload.get("intakeMode")
        )
        if requested_mode in {"prompt_first", "structured"}:
            return requested_mode
        if any(decision_intake.values()):
            return "prompt_first"
        if not isinstance(payload.get("objective"), dict):
            return "prompt_first"
        return "structured"

    @staticmethod
    def _build_prompt_matches(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
        context: Dict[str, Any],
    ) -> Dict[str, List[Dict[str, Any]]]:
        text_blob = DecisionWorkspaceService._build_prompt_text_blob(decision_prompt, decision_intake)
        tokens = DecisionWorkspaceService._tokenize_prompt_text(text_blob)

        metric_matches = DecisionWorkspaceService._rank_prompt_candidates(
            candidates=context.get("metrics") or [],
            tokens=tokens,
            text_blob=text_blob,
            ref_builder=build_metric_ref,
        )
        dimension_matches = DecisionWorkspaceService._rank_prompt_candidates(
            candidates=context.get("dimensions") or [],
            tokens=tokens,
            text_blob=text_blob,
            ref_builder=build_dimension_ref,
        )

        return {
            "metrics": metric_matches[:5],
            "dimensions": dimension_matches[:4],
        }

    @staticmethod
    def _build_prompt_text_blob(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
    ) -> str:
        return " ".join(
            part.strip()
            for part in [
                decision_prompt,
                decision_intake.get("what_matters"),
                decision_intake.get("what_to_avoid"),
                decision_intake.get("additional_context"),
            ]
            if str(part or "").strip()
        )

    @staticmethod
    def _tokenize_prompt_text(text: str) -> List[str]:
        return [
            DecisionWorkspaceService._normalize_prompt_token(token)
            for token in re.findall(r"[a-z0-9%]+", str(text or "").lower())
            if len(token) > 2 and token not in DecisionWorkspaceService.PROMPT_MATCH_STOPWORDS
        ]

    @staticmethod
    def _rank_prompt_candidates(
        candidates: Sequence[Dict[str, Any]],
        tokens: Sequence[str],
        text_blob: str,
        ref_builder,
    ) -> List[Dict[str, Any]]:
        ranked: List[Tuple[int, Dict[str, Any]]] = []
        normalized_blob = DecisionWorkspaceService._normalize_phrase(text_blob)
        for candidate in candidates:
            score = DecisionWorkspaceService._score_prompt_candidate(candidate, tokens, normalized_blob)
            if score <= 0:
                continue
            ranked.append((score, ref_builder(candidate)))

        ranked.sort(
            key=lambda item: (
                -item[0],
                str(item[1].get("label") or item[1].get("name") or ""),
            )
        )
        return [item[1] for item in ranked]

    @staticmethod
    def _score_prompt_candidate(
        candidate: Dict[str, Any],
        tokens: Sequence[str],
        normalized_blob: str,
    ) -> int:
        score = 0
        candidate_tokens: List[str] = []
        for key in ("label", "name", "field", "id"):
            normalized_value = DecisionWorkspaceService._normalize_phrase(candidate.get(key))
            if not normalized_value:
                continue
            value_tokens = [
                DecisionWorkspaceService._normalize_prompt_token(token)
                for token in normalized_value.split()
                if token not in DecisionWorkspaceService.PROMPT_MATCH_STOPWORDS
            ]
            candidate_tokens.extend(value_tokens)
            if normalized_value in normalized_blob:
                score += 6 + len(value_tokens)

        if not candidate_tokens:
            return score

        overlap = set(candidate_tokens).intersection(tokens)
        score += len(overlap) * 3
        if len(overlap) == len(set(candidate_tokens)) and overlap:
            score += 2
        return score

    @staticmethod
    def _build_prompt_first_draft(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
        intake_mode: str,
        prompt_matches: Dict[str, List[Dict[str, Any]]],
    ) -> Dict[str, Any]:
        if intake_mode != "prompt_first":
            return {
                "objective": None,
                "levers": [],
                "constraints": [],
                "clarification_hints": [],
            }

        prompt_frame = DecisionWorkspaceService._build_prompt_frame(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
        )
        objective = DecisionWorkspaceService._draft_objective(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
            prompt_matches=prompt_matches,
            prompt_frame=prompt_frame,
        )
        constraints = DecisionWorkspaceService._draft_constraints(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
            prompt_matches=prompt_matches,
            prompt_frame=prompt_frame,
        )
        levers = DecisionWorkspaceService._draft_levers(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
            prompt_matches=prompt_matches,
            objective=objective,
            constraints=constraints,
            prompt_frame=prompt_frame,
        )

        return {
            "objective": objective,
            "levers": levers,
            "constraints": constraints,
            "prompt_frame": prompt_frame,
            "clarification_hints": DecisionWorkspaceService._build_prompt_first_clarification_hints(
                decision_intake=decision_intake,
                prompt_matches=prompt_matches,
                objective=objective,
                levers=levers,
                constraints=constraints,
                prompt_frame=prompt_frame,
            ),
        }

    @staticmethod
    def _draft_objective(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
        prompt_matches: Dict[str, List[Dict[str, Any]]],
        prompt_frame: Dict[str, Any],
    ) -> Dict[str, Any]:
        objective_text = DecisionWorkspaceService._clean_text(prompt_frame.get("objective_clause")) or ""
        objective_metric = DecisionWorkspaceService._find_best_prompt_metric_match(
            objective_text,
            prompt_matches.get("metrics") or [],
        )
        direction = DecisionWorkspaceService._infer_objective_direction(objective_text or decision_prompt)

        if objective_text:
            statement = objective_text
        elif objective_metric:
            leading_verb = {
                "maximize": "Increase",
                "minimize": "Reduce",
                "maintain": "Maintain",
                "achieve_target": "Hit",
            }.get(direction, "Improve")
            statement = f"{leading_verb} {objective_metric.get('label') or objective_metric.get('name')}"
        else:
            statement = decision_prompt

        return {
            "statement": statement,
            "metric_id": objective_metric.get("metric_id") if objective_metric else None,
            "direction": direction,
            "time_horizon": prompt_frame.get("time_horizon"),
        }

    @staticmethod
    def _draft_levers(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
        prompt_matches: Dict[str, List[Dict[str, Any]]],
        objective: Dict[str, Any],
        constraints: Sequence[Dict[str, Any]],
        prompt_frame: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        text_blob = DecisionWorkspaceService._build_prompt_text_blob(decision_prompt, decision_intake)
        lever_text = DecisionWorkspaceService._clean_text(prompt_frame.get("lever_clause")) or text_blob
        segment_text = DecisionWorkspaceService._clean_text(prompt_frame.get("segment_clause")) or ""
        lever_and_segment_text = " ".join(part for part in [lever_text, segment_text] if part)
        objective_metric_id = objective.get("metric_id")
        constraint_metric_ids = {
            (constraint.get("binding") or {}).get("metric_id")
            for constraint in constraints
            if isinstance((constraint.get("binding") or {}), dict)
        }
        levers: List[Dict[str, Any]] = []
        ranked_metric_refs = DecisionWorkspaceService._rank_prompt_refs(
            lever_text,
            prompt_matches.get("metrics") or [],
        )

        for metric_ref in ranked_metric_refs:
            metric_id = metric_ref.get("metric_id")
            if not metric_id or metric_id == objective_metric_id or metric_id in constraint_metric_ids:
                continue
            label = metric_ref.get("label") or metric_ref.get("name") or "Draft lever"
            levers.append(
                {
                    "label": label,
                    "lever_type": DecisionWorkspaceService._infer_lever_type(label),
                    "binding": {"metric_id": metric_id},
                    "desired_change": DecisionWorkspaceService._infer_desired_change(text_blob),
                }
            )
            if len(levers) >= 2:
                break

        normalized_lever_text = DecisionWorkspaceService._normalize_phrase(lever_and_segment_text)
        dimension_keywords_present = any(
            keyword in normalized_lever_text
            for keyword in ("mix", "region", "channel", "segment", "allocation", "category", "product")
        )
        if dimension_keywords_present:
            ranked_dimension_refs = DecisionWorkspaceService._rank_prompt_refs(
                lever_and_segment_text,
                prompt_matches.get("dimensions") or [],
            )
            for dimension_ref in ranked_dimension_refs:
                dimension_id = dimension_ref.get("dimension_id")
                if not dimension_id:
                    continue
                levers.append(
                    {
                        "label": f"{dimension_ref.get('label') or dimension_ref.get('name')} mix",
                        "lever_type": "mix",
                        "binding": {"dimension_id": dimension_id},
                        "desired_change": "shift",
                    }
                )
                break

        return levers

    @staticmethod
    def _draft_constraints(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
        prompt_matches: Dict[str, List[Dict[str, Any]]],
        prompt_frame: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        clauses = list(prompt_frame.get("constraint_clauses") or [])
        constraints: List[Dict[str, Any]] = []
        used_metric_ids = set()

        for clause in clauses:
            metric_ref = DecisionWorkspaceService._find_best_prompt_metric_match(
                clause,
                prompt_matches.get("metrics") or [],
            )
            metric_id = metric_ref.get("metric_id") if isinstance(metric_ref, dict) else None
            if not metric_id or metric_id in used_metric_ids:
                continue
            used_metric_ids.add(metric_id)
            operator = "gte"
            normalized_clause = DecisionWorkspaceService._normalize_phrase(clause)
            if any(
                word in normalized_clause
                for word in ("cap", "limit", "under", "below", "increase", "increasing", "raise", "raising")
            ):
                operator = "lte"
            constraints.append(
                {
                    "label": f"Protect {metric_ref.get('label') or metric_ref.get('name')}",
                    "description": clause,
                    "constraint_type": "metric_guardrail",
                    "binding": {"metric_id": metric_id},
                    "condition": {
                        "operator": operator,
                        "value": None,
                        "secondary_value": None,
                        "values": None,
                        "unit": None,
                    },
                    "hardness": "hard",
                }
            )
            if len(constraints) >= 2:
                break

        return constraints

    @staticmethod
    def _build_prompt_first_clarification_hints(
        decision_intake: Dict[str, Optional[str]],
        prompt_matches: Dict[str, List[Dict[str, Any]]],
        objective: Dict[str, Any],
        levers: Sequence[Dict[str, Any]],
        constraints: Sequence[Dict[str, Any]],
        prompt_frame: Dict[str, Any],
    ) -> List[str]:
        hints: List[str] = []
        if not objective.get("metric_id"):
            objective_clause = DecisionWorkspaceService._clean_text(prompt_frame.get("objective_clause"))
            metric_labels = [
                str(item.get("label") or item.get("name") or "").strip()
                for item in (prompt_matches.get("metrics") or [])[:3]
                if str(item.get("label") or item.get("name") or "").strip()
            ]
            metric_examples = f" Candidates in context include {', '.join(metric_labels)}." if metric_labels else ""
            if objective_clause:
                hints.append(
                    f"Which success metric should '{objective_clause}' optimize?{metric_examples}"
                )
            else:
                hints.append(
                    f"Which metric should define success for this decision?{metric_examples}"
                )
        if not levers:
            objective_label = (
                ((objective or {}).get("statement") or "").strip()
                or "the objective"
            )
            hints.append(f"What controllable lever can the team change to affect {objective_label}?")
        if not objective.get("time_horizon"):
            hints.append("What time horizon should this decision use?")
        if decision_intake.get("what_to_avoid") and not constraints:
            hints.append("Clarify the main guardrail in metric or business terms so the draft can bind it.")
        for clause in prompt_frame.get("constraint_clauses") or []:
            if constraints and DecisionWorkspaceService._find_best_prompt_metric_match(
                clause,
                [
                    ((constraint.get("binding") or {}).get("metric_ref") or {})
                    for constraint in constraints
                    if isinstance(constraint.get("binding"), dict)
                ],
            ):
                continue
            if not DecisionWorkspaceService._find_best_prompt_metric_match(clause, prompt_matches.get("metrics") or []):
                hints.append(f"Which metric should represent the guardrail '{clause}'?")
        segment_clause = DecisionWorkspaceService._clean_text(prompt_frame.get("segment_clause"))
        if segment_clause and not DecisionWorkspaceService._find_best_prompt_dimension_match(
            segment_clause,
            prompt_matches.get("dimensions") or [],
        ):
            hints.append(f"Which segment or dimension should the draft use for '{segment_clause}'?")
        if not prompt_matches.get("metrics"):
            hints.append("No strong metric match was found from the prompt, so expect metric binding follow-up.")
        return DecisionWorkspaceService._dedupe_strings(hints)

    @staticmethod
    def _build_prompt_frame(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
    ) -> Dict[str, Any]:
        """
        Split the plain-English prompt into decision roles before drafting.

        The parser stays deterministic, but keeping role evidence separate makes
        it harder for a lever or guardrail metric to become the objective.
        """
        text_blob = DecisionWorkspaceService._build_prompt_text_blob(decision_prompt, decision_intake)
        objective_clause = DecisionWorkspaceService._extract_objective_clause(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
        )
        lever_clause = DecisionWorkspaceService._extract_lever_clause(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
        )
        constraint_clauses = DecisionWorkspaceService._extract_constraint_clauses(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
        )
        segment_clause = DecisionWorkspaceService._extract_segment_clause(
            decision_prompt=decision_prompt,
            decision_intake=decision_intake,
        )
        return {
            "objective_clause": objective_clause,
            "lever_clause": lever_clause,
            "constraint_clauses": constraint_clauses,
            "segment_clause": segment_clause,
            "time_horizon": DecisionWorkspaceService._infer_time_horizon_from_text(text_blob),
        }

    @staticmethod
    def _extract_constraint_clauses(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
    ) -> List[str]:
        clauses: List[str] = []
        what_to_avoid = decision_intake.get("what_to_avoid")
        if what_to_avoid:
            clauses.append(what_to_avoid)

        prompt = str(decision_prompt or "")
        patterns = [
            r"\bwithout\s+(.+?)(?=\b(?:using|via|through|with|while|but|and using|and via|and through)\b|[,.;!?]|$)",
            r"\bprotect(?:ing)?\s+(.+?)(?=\b(?:using|via|through|with|while|but|and using|and via|and through)\b|[,.;!?]|$)",
            r"\bavoid(?:ing)?\s+(.+?)(?=\b(?:using|via|through|with|while|but|and using|and via|and through)\b|[,.;!?]|$)",
            r"\bstay within\s+(.+?)(?=\b(?:using|via|through|with|while|but|and using|and via|and through)\b|[,.;!?]|$)",
            r"\bkeep(?:ing)?\s+(.+?)(?=\b(?:using|via|through|with|while|but|and using|and via|and through)\b|[,.;!?]|$)",
        ]
        for pattern in patterns:
            for match in re.findall(pattern, prompt, flags=re.IGNORECASE):
                cleaned = DecisionWorkspaceService._clean_text(match)
                if cleaned:
                    clauses.append(cleaned)
        return DecisionWorkspaceService._dedupe_strings(clauses)

    @staticmethod
    def _extract_objective_clause(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
    ) -> str:
        objective_text = DecisionWorkspaceService._clean_text(decision_intake.get("what_matters"))
        if objective_text:
            return objective_text

        prompt = DecisionWorkspaceService._clean_text(decision_prompt) or ""
        if not prompt:
            return ""

        cleaned_prompt = re.sub(
            r"^(how should we|how do we|what should we do to|what can we do to|help us)\s+",
            "",
            prompt,
            flags=re.IGNORECASE,
        )
        if DecisionWorkspaceService._looks_like_lever_only_clause(cleaned_prompt):
            return ""
        return DecisionWorkspaceService._split_on_intent_boundary(cleaned_prompt)

    @staticmethod
    def _extract_lever_clause(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
    ) -> str:
        additional_context = DecisionWorkspaceService._clean_text(decision_intake.get("additional_context"))
        prompt = DecisionWorkspaceService._clean_text(decision_prompt) or ""
        clauses: List[str] = []
        if additional_context:
            clauses.append(additional_context)

        lever_match = re.search(
            r"\b(?:using|via|through|with)\s+(.+?)(?:\bwithout\b|\bwhile\b|\bbut\b|[?.!]|$)",
            prompt,
            flags=re.IGNORECASE,
        )
        if lever_match:
            clause = DecisionWorkspaceService._clean_text(lever_match.group(1))
            if clause:
                clauses.append(clause)

        leading_lever_match = re.search(
            r"^(?:how should we\s+|how do we\s+|should we\s+)?"
            r"(?:adjust|change|shift|rebalance|reallocate|allocate|set|use|using)\s+"
            r"(.+?)(?:\bwithout\b|\bwhile\b|\bbut\b|[?.!]|$)",
            prompt,
            flags=re.IGNORECASE,
        )
        if leading_lever_match:
            clause = DecisionWorkspaceService._clean_text(leading_lever_match.group(1))
            if clause:
                clauses.append(clause)

        return " ".join(DecisionWorkspaceService._dedupe_strings(clauses))

    @staticmethod
    def _extract_segment_clause(
        decision_prompt: str,
        decision_intake: Dict[str, Optional[str]],
    ) -> str:
        prompt = DecisionWorkspaceService._clean_text(decision_prompt) or ""
        additional_context = DecisionWorkspaceService._clean_text(decision_intake.get("additional_context")) or ""
        clauses: List[str] = []
        for source in [prompt, additional_context]:
            for pattern in (
                r"\bby\s+(.+?)(?=\b(?:without|while|but|using|via|through|with)\b|[,.;!?]|$)",
                r"\bacross\s+(.+?)(?=\b(?:without|while|but|using|via|through|with)\b|[,.;!?]|$)",
                r"\bfor\s+(.+?)(?=\b(?:without|while|but|using|via|through|with)\b|[,.;!?]|$)",
            ):
                for match in re.findall(pattern, source, flags=re.IGNORECASE):
                    cleaned = DecisionWorkspaceService._clean_text(match)
                    if cleaned:
                        clauses.append(cleaned)
        return " ".join(DecisionWorkspaceService._dedupe_strings(clauses))

    @staticmethod
    def _looks_like_lever_only_clause(text: str) -> bool:
        normalized = DecisionWorkspaceService._normalize_phrase(text)
        if not normalized:
            return False
        leading_lever_verbs = (
            "adjust",
            "change",
            "shift",
            "rebalance",
            "reallocate",
            "allocate",
            "set",
            "use",
        )
        objective_verbs = (
            "grow",
            "increase",
            "improve",
            "reduce",
            "decrease",
            "maximize",
            "minimize",
            "protect",
            "maintain",
        )
        return normalized.startswith(leading_lever_verbs) and not any(
            f"{verb} " in normalized or normalized.startswith(verb)
            for verb in objective_verbs
        )

    @staticmethod
    def _split_on_intent_boundary(text: str) -> str:
        cleaned = DecisionWorkspaceService._clean_text(text) or ""
        if not cleaned:
            return ""
        boundary_match = re.search(
            r"\b(?:using|via|through|with|without|while|but)\b",
            cleaned,
            flags=re.IGNORECASE,
        )
        if boundary_match:
            cleaned = cleaned[: boundary_match.start()]
        return DecisionWorkspaceService._clean_text(cleaned.rstrip(" ,.;:?!")) or ""

    @staticmethod
    def _rank_prompt_refs(
        text: str,
        refs: Sequence[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        tokens = DecisionWorkspaceService._tokenize_prompt_text(text)
        normalized_text = DecisionWorkspaceService._normalize_phrase(text)
        ranked: List[Tuple[int, Dict[str, Any]]] = []
        for ref in refs:
            if not DecisionWorkspaceService._has_strong_ref_evidence(text, ref):
                continue
            score = DecisionWorkspaceService._score_prompt_candidate(ref, tokens, normalized_text)
            if score <= 0:
                continue
            ranked.append((score, ref))
        ranked.sort(
            key=lambda item: (
                -item[0],
                str(item[1].get("label") or item[1].get("name") or ""),
            )
        )
        return [item[1] for item in ranked]

    @staticmethod
    def _has_strong_ref_evidence(text: str, ref: Dict[str, Any]) -> bool:
        normalized_text = DecisionWorkspaceService._normalize_phrase(text)
        if not normalized_text:
            return False

        for key in ("label", "name", "field"):
            normalized_value = DecisionWorkspaceService._normalize_phrase(ref.get(key))
            if normalized_value and normalized_value in normalized_text:
                return True

        text_tokens = set(DecisionWorkspaceService._tokenize_prompt_text(text))
        candidate_tokens: List[str] = []
        for key in ("label", "name", "field"):
            normalized_value = DecisionWorkspaceService._normalize_phrase(ref.get(key))
            candidate_tokens.extend(
                DecisionWorkspaceService._normalize_prompt_token(token)
                for token in normalized_value.split()
                if token not in DecisionWorkspaceService.PROMPT_MATCH_STOPWORDS
            )
        salient_tokens = [
            token for token in DecisionWorkspaceService._dedupe_strings(candidate_tokens)
            if token and token not in DecisionWorkspaceService.GENERIC_METRIC_TOKENS
        ]
        return any(token in text_tokens for token in salient_tokens)

    @staticmethod
    def _find_best_prompt_metric_match(
        text: str,
        metric_refs: Sequence[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        text_tokens = DecisionWorkspaceService._tokenize_prompt_text(text)
        normalized_text = DecisionWorkspaceService._normalize_phrase(text)
        best_score = 0
        best_match: Optional[Dict[str, Any]] = None
        for metric_ref in metric_refs:
            if not DecisionWorkspaceService._has_strong_ref_evidence(text, metric_ref):
                continue
            score = DecisionWorkspaceService._score_prompt_candidate(metric_ref, text_tokens, normalized_text)
            if score > best_score:
                best_score = score
                best_match = metric_ref
        return best_match

    @staticmethod
    def _find_best_prompt_dimension_match(
        text: str,
        dimension_refs: Sequence[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        text_tokens = DecisionWorkspaceService._tokenize_prompt_text(text)
        normalized_text = DecisionWorkspaceService._normalize_phrase(text)
        best_score = 0
        best_match: Optional[Dict[str, Any]] = None
        for dimension_ref in dimension_refs:
            if not DecisionWorkspaceService._has_strong_ref_evidence(text, dimension_ref):
                continue
            score = DecisionWorkspaceService._score_prompt_candidate(dimension_ref, text_tokens, normalized_text)
            if score > best_score:
                best_score = score
                best_match = dimension_ref
        return best_match

    @staticmethod
    def _infer_objective_direction(text: str) -> str:
        normalized = DecisionWorkspaceService._normalize_phrase(text)
        if any(word in normalized for word in ("reduce", "decrease", "lower", "cut", "minimize")):
            return "minimize"
        if any(word in normalized for word in ("maintain", "protect", "preserve", "keep", "avoid")):
            return "maintain"
        if any(word in normalized for word in ("target", "hit", "reach", "achieve")):
            return "achieve_target"
        return "maximize"

    @staticmethod
    def _infer_desired_change(text: str) -> str:
        normalized = DecisionWorkspaceService._normalize_phrase(text)
        if any(word in normalized for word in ("reduce", "decrease", "lower", "cut")):
            return "decrease"
        if any(word in normalized for word in ("shift", "rebalance", "reallocate")):
            return "shift"
        if any(word in normalized for word in ("tighten", "limit", "cap")):
            return "tighten"
        return "increase"

    @staticmethod
    def _infer_lever_type(label: str) -> str:
        normalized = DecisionWorkspaceService._normalize_phrase(label)
        if any(word in normalized for word in ("policy", "discount")):
            return "policy_choice"
        if any(word in normalized for word in ("mix", "share", "allocation")):
            return "mix"
        if "tim" in normalized:
            return "timing"
        return "numeric_input"

    @staticmethod
    def _infer_time_horizon_from_text(text: str) -> Optional[Dict[str, Any]]:
        normalized = DecisionWorkspaceService._normalize_phrase(text)
        if "next quarter" in normalized:
            return {
                "kind": "relative_period",
                "label": "Next quarter",
                "start": None,
                "end": None,
                "grain": "quarter",
            }
        if "this quarter" in normalized:
            return {
                "kind": "relative_period",
                "label": "This quarter",
                "start": None,
                "end": None,
                "grain": "quarter",
            }
        if "next month" in normalized:
            return {
                "kind": "relative_period",
                "label": "Next month",
                "start": None,
                "end": None,
                "grain": "month",
            }
        if "next week" in normalized:
            return {
                "kind": "relative_period",
                "label": "Next week",
                "start": None,
                "end": None,
                "grain": "week",
            }
        if "this year" in normalized or "next year" in normalized:
            return {
                "kind": "relative_period",
                "label": "This year" if "this year" in normalized else "Next year",
                "start": None,
                "end": None,
                "grain": "year",
            }
        rolling_match = re.search(r"\bnext\s+(\d{1,2})\s+(day|days|week|weeks|month|months|quarter|quarters)\b", normalized)
        if rolling_match:
            amount = int(rolling_match.group(1))
            unit = rolling_match.group(2)
            grain = unit[:-1] if unit.endswith("s") else unit
            return {
                "kind": "rolling_window",
                "label": f"Next {amount} {unit}",
                "start": None,
                "end": None,
                "grain": grain,
            }
        quarter_match = re.search(r"\bq([1-4])\s*(20\d{2})?\b", normalized)
        if quarter_match:
            year = quarter_match.group(2)
            label = f"Q{quarter_match.group(1)}"
            if year:
                label = f"{label} {year}"
            return {
                "kind": "named_period",
                "label": label,
                "start": None,
                "end": None,
                "grain": "quarter",
            }
        return None

    @staticmethod
    def _build_drafting_summary(
        intake_mode: str,
        decision_intake: Dict[str, Optional[str]],
        prompt_matches: Dict[str, List[Dict[str, Any]]],
        clarification_hints: Sequence[str],
        objective_source: str,
        levers_source: str,
        constraints_source: str,
        prompt_frame: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return {
            "intake_mode": intake_mode,
            "helper_prompts": {
                "what_matters": decision_intake.get("what_matters"),
                "what_to_avoid": decision_intake.get("what_to_avoid"),
                "additional_context": decision_intake.get("additional_context"),
            },
            "source_summary": {
                "objective": objective_source,
                "levers": levers_source,
                "constraints": constraints_source,
            },
            "prompt_matches": {
                "metrics": list(prompt_matches.get("metrics") or []),
                "dimensions": list(prompt_matches.get("dimensions") or []),
            },
            "clarification_hints": list(DecisionWorkspaceService._dedupe_strings(clarification_hints)),
            "prompt_frame": prompt_frame or {},
        }

    @staticmethod
    def _normalize_existing_drafting(
        raw: Any,
        objective_present: bool,
        levers_present: bool,
        constraints_present: bool,
    ) -> Dict[str, Any]:
        raw = raw if isinstance(raw, dict) else {}
        helper_prompts = raw.get("helper_prompts") if isinstance(raw.get("helper_prompts"), dict) else {}
        source_summary = raw.get("source_summary") if isinstance(raw.get("source_summary"), dict) else {}
        prompt_matches = raw.get("prompt_matches") if isinstance(raw.get("prompt_matches"), dict) else {}
        return {
            "intake_mode": raw.get("intake_mode") or "structured",
            "helper_prompts": {
                "what_matters": DecisionWorkspaceService._clean_text(helper_prompts.get("what_matters")),
                "what_to_avoid": DecisionWorkspaceService._clean_text(helper_prompts.get("what_to_avoid")),
                "additional_context": DecisionWorkspaceService._clean_text(helper_prompts.get("additional_context")),
            },
            "source_summary": {
                "objective": source_summary.get("objective") or ("user_input" if objective_present else "none"),
                "levers": source_summary.get("levers") or ("user_input" if levers_present else "none"),
                "constraints": source_summary.get("constraints") or ("user_input" if constraints_present else "none"),
            },
            "prompt_matches": {
                "metrics": list(prompt_matches.get("metrics") or []),
                "dimensions": list(prompt_matches.get("dimensions") or []),
            },
            "clarification_hints": list(raw.get("clarification_hints") or []),
            "prompt_frame": raw.get("prompt_frame") if isinstance(raw.get("prompt_frame"), dict) else {},
        }

    @staticmethod
    def _clean_text(value: Any) -> Optional[str]:
        text = str(value or "").strip()
        return text if text else None

    @staticmethod
    def _normalize_phrase(value: Any) -> str:
        return " ".join(re.findall(r"[a-z0-9%]+", str(value or "").lower()))

    @staticmethod
    def _normalize_prompt_token(token: str) -> str:
        normalized = str(token or "").strip().lower()
        if len(normalized) > 5 and normalized.endswith("ing"):
            normalized = normalized[:-3]
        elif len(normalized) > 4 and normalized.endswith("ed"):
            normalized = normalized[:-2]
        elif len(normalized) > 4 and normalized.endswith("es"):
            normalized = normalized[:-2]
        elif len(normalized) > 3 and normalized.endswith("s") and not normalized.endswith("%"):
            normalized = normalized[:-1]
        return normalized

    @staticmethod
    def _normalize_objective(raw: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        statement = str(raw.get("statement") or "").strip()
        if not statement:
            raise DecisionServiceError("objective.statement is required.")

        metric_reference = raw.get("metric_id") or raw.get("metric_name")
        metric = DecisionWorkspaceService._find_metric(context, metric_reference)
        metric_ref = build_metric_ref(metric) if metric else None

        if metric_ref:
            resolution_status = "resolved"
            reason = None
        elif metric_reference:
            resolution_status = "partial"
            reason = f"Objective metric '{metric_reference}' was not found in the semantic model."
        else:
            resolution_status = "unresolved"
            reason = "No objective metric binding was provided."

        return {
            "objective_id": raw.get("objective_id") or make_identifier("objective", statement[:48]),
            "statement": statement,
            "direction": str(raw.get("direction") or "maximize").strip(),
            "target": DecisionWorkspaceService._normalize_value_condition(raw.get("target"), allow_none=True),
            "time_horizon": DecisionWorkspaceService._normalize_time_horizon(raw.get("time_horizon")),
            "metric_ref": metric_ref,
            "resolution_status": resolution_status,
            "reason": reason,
        }

    @staticmethod
    def _normalize_lever(raw: Dict[str, Any], context: Dict[str, Any], index: int) -> Dict[str, Any]:
        if not isinstance(raw, dict):
            raise DecisionServiceError("Each lever must be an object.")

        label = str(raw.get("label") or "").strip()
        if not label:
            raise DecisionServiceError("lever.label is required.")

        binding_payload = raw.get("binding")
        if binding_payload is None:
            binding_payload = {}
        elif not isinstance(binding_payload, dict):
            raise DecisionServiceError(f"lever '{label}' has an invalid binding payload.")

        binding = DecisionWorkspaceService._resolve_binding(
            binding_input={
                **binding_payload,
                "metric_name": binding_payload.get("metric_name") or raw.get("metric_name"),
                "field": binding_payload.get("field") or raw.get("field"),
            },
            context=context,
        )

        return {
            "lever_id": raw.get("lever_id") or make_identifier("lever", label, index + 1),
            "label": label,
            "description": raw.get("description"),
            "lever_type": str(raw.get("lever_type") or "numeric_input").strip(),
            "binding": binding,
            "desired_change": raw.get("desired_change"),
            "current_value": raw.get("current_value"),
            "bounds": DecisionWorkspaceService._normalize_bounds(raw.get("bounds")),
            "controllable": bool(raw.get("controllable", True)),
        }

    @staticmethod
    def _normalize_constraint(raw: Dict[str, Any], context: Dict[str, Any], index: int) -> Dict[str, Any]:
        if not isinstance(raw, dict):
            raise DecisionServiceError("Each constraint must be an object.")

        label = str(raw.get("label") or "").strip()
        if not label:
            raise DecisionServiceError("constraint.label is required.")

        binding_payload = raw.get("binding")
        if binding_payload is None:
            binding_payload = {}
        elif not isinstance(binding_payload, dict):
            raise DecisionServiceError(f"constraint '{label}' has an invalid binding payload.")

        condition = DecisionWorkspaceService._normalize_value_condition(raw.get("condition"), allow_none=False)
        binding = DecisionWorkspaceService._resolve_binding(binding_payload, context)

        return {
            "constraint_id": raw.get("constraint_id") or make_identifier("constraint", label, index + 1),
            "label": label,
            "description": raw.get("description"),
            "constraint_type": str(raw.get("constraint_type") or "metric_guardrail").strip(),
            "binding": binding,
            "condition": condition,
            "hardness": str(raw.get("hardness") or "hard").strip(),
            "rationale": raw.get("rationale"),
        }

    @staticmethod
    def _normalize_value_condition(raw: Any, allow_none: bool) -> Optional[Dict[str, Any]]:
        if raw is None:
            if allow_none:
                return None
            raise DecisionServiceError("constraint.condition is required.")
        if not isinstance(raw, dict):
            raise DecisionServiceError("Value conditions must be objects.")

        operator = str(raw.get("operator") or "").strip()
        if not operator:
            raise DecisionServiceError("Value conditions require an operator.")
        if operator == "between" and raw.get("secondary_value") is None:
            raise DecisionServiceError("Value conditions with operator 'between' require secondary_value.")
        if operator in {"in", "not_in"} and not isinstance(raw.get("values"), list):
            raise DecisionServiceError(f"Value conditions with operator '{operator}' require values.")

        return {
            "operator": operator,
            "value": raw.get("value"),
            "secondary_value": raw.get("secondary_value"),
            "values": raw.get("values"),
            "unit": raw.get("unit"),
        }

    @staticmethod
    def _normalize_time_horizon(raw: Any) -> Optional[Dict[str, Any]]:
        if raw is None:
            return None
        if not isinstance(raw, dict):
            raise DecisionServiceError("objective.time_horizon must be an object when provided.")

        label = str(raw.get("label") or "").strip()
        if not label:
            raise DecisionServiceError("objective.time_horizon.label is required when time_horizon is provided.")

        return {
            "kind": str(raw.get("kind") or "open_ended").strip(),
            "label": label,
            "start": raw.get("start"),
            "end": raw.get("end"),
            "grain": raw.get("grain"),
        }

    @staticmethod
    def _normalize_bounds(raw: Any) -> Optional[Dict[str, Any]]:
        if raw is None:
            return None
        if not isinstance(raw, dict):
            raise DecisionServiceError("lever.bounds must be an object when provided.")
        allowed_values = raw.get("allowed_values")
        if allowed_values is not None and not isinstance(allowed_values, list):
            raise DecisionServiceError("lever.bounds.allowed_values must be an array when provided.")
        return {
            "min_value": raw.get("min_value"),
            "max_value": raw.get("max_value"),
            "allowed_values": allowed_values,
            "unit": raw.get("unit"),
        }

    @staticmethod
    def _resolve_binding(binding_input: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        metric_reference = binding_input.get("metric_id") or binding_input.get("metric_name")
        dimension_reference = binding_input.get("dimension_id") or binding_input.get("dimension_name")
        field = DecisionWorkspaceService._normalize_text(binding_input.get("field"))

        if metric_reference:
            metric = DecisionWorkspaceService._find_metric(context, metric_reference)
            if metric:
                return {
                    "binding_type": "metric",
                    "status": "resolved",
                    "metric_ref": build_metric_ref(metric),
                    "dimension_ref": None,
                    "field": None,
                    "reason": None,
                }
            return {
                "binding_type": "metric",
                "status": "partial",
                "metric_ref": None,
                "dimension_ref": None,
                "field": None,
                "reason": f"Metric '{metric_reference}' was not found in the semantic model.",
            }

        if dimension_reference:
            dimension = DecisionWorkspaceService._find_dimension(context, dimension_reference)
            if dimension:
                return {
                    "binding_type": "dimension",
                    "status": "resolved",
                    "metric_ref": None,
                    "dimension_ref": build_dimension_ref(dimension),
                    "field": None,
                    "reason": None,
                }
            return {
                "binding_type": "dimension",
                "status": "partial",
                "metric_ref": None,
                "dimension_ref": None,
                "field": None,
                "reason": f"Dimension '{dimension_reference}' was not found in the semantic model.",
            }

        if field:
            dimension = DecisionWorkspaceService._find_dimension_by_field(context, field)
            if dimension:
                return {
                    "binding_type": "dimension",
                    "status": "resolved",
                    "metric_ref": None,
                    "dimension_ref": build_dimension_ref(dimension),
                    "field": None,
                    "reason": None,
                }

            metric = DecisionWorkspaceService._find_metric_by_field(context, field)
            if metric:
                return {
                    "binding_type": "metric",
                    "status": "resolved",
                    "metric_ref": build_metric_ref(metric),
                    "dimension_ref": None,
                    "field": None,
                    "reason": None,
                }

            if field in {str(column) for column in context["dataframe"].columns}:
                return {
                    "binding_type": "field",
                    "status": "resolved",
                    "metric_ref": None,
                    "dimension_ref": None,
                    "field": field,
                    "reason": None,
                }

            return {
                "binding_type": "field",
                "status": "unresolved",
                "metric_ref": None,
                "dimension_ref": None,
                "field": field,
                "reason": f"Field '{field}' does not exist in the dataset.",
            }

        return {
            "binding_type": "none",
            "status": "unresolved",
            "metric_ref": None,
            "dimension_ref": None,
            "field": None,
            "reason": "No binding was provided.",
        }

    @staticmethod
    def _resolve_workspace_for_analysis(payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        existing_workspace = payload.get("decision_workspace")
        if isinstance(existing_workspace, dict):
            return DecisionWorkspaceService._normalize_existing_workspace(existing_workspace, context)
        return DecisionWorkspaceService._build_workspace_artifacts(payload, context=context)["workspace"]

    @staticmethod
    def _normalize_existing_workspace(workspace: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        decision_scope = workspace.get("decision_scope")
        if not isinstance(decision_scope, dict):
            raise DecisionServiceError("decision_workspace.decision_scope is required for workspace analysis.")

        objective = decision_scope.get("objective")
        levers = decision_scope.get("levers")
        constraints = decision_scope.get("constraints")
        if not isinstance(objective, dict):
            raise DecisionServiceError("decision_workspace.decision_scope.objective is required for workspace analysis.")
        if not isinstance(levers, list):
            raise DecisionServiceError("decision_workspace.decision_scope.levers must be an array for workspace analysis.")
        if not isinstance(constraints, list):
            raise DecisionServiceError(
                "decision_workspace.decision_scope.constraints must be an array for workspace analysis."
            )

        scoped_context = workspace.get("scoped_context") if isinstance(workspace.get("scoped_context"), dict) else {}
        unknowns = workspace.get("unknowns") if isinstance(workspace.get("unknowns"), list) else []
        readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else None
        if readiness is None:
            readiness = DecisionWorkspaceService._evaluate_readiness(
                objective=objective,
                levers=levers,
                constraints=constraints,
                unknowns=unknowns,
            )
        drafting = DecisionWorkspaceService._normalize_existing_drafting(
            workspace.get("drafting"),
            objective_present=bool(objective),
            levers_present=bool(levers),
            constraints_present=bool(constraints),
        )

        return {
            "workspace_id": workspace.get("workspace_id")
            or make_identifier("decision_workspace", objective.get("objective_id") or objective.get("statement")),
            "workspace_type": workspace.get("workspace_type") or "scoped_decision",
            "status": workspace.get("status") or DecisionWorkspaceService._derive_workspace_status(readiness),
            "title": workspace.get("title") or DecisionWorkspaceService._generate_title(objective),
            "decision_prompt": str(workspace.get("decision_prompt") or "").strip(),
            "dataset": context["dataset"],
            "decision_scope": {
                "objective": objective,
                "levers": levers,
                "constraints": constraints,
            },
            "scope_summary": workspace.get("scope_summary")
            or DecisionWorkspaceService._generate_scope_summary(objective, levers, constraints),
            "scoped_context": {
                "relevant_metrics": list(scoped_context.get("relevant_metrics") or []),
                "relevant_dimensions": list(scoped_context.get("relevant_dimensions") or []),
                "comparison_dimensions": list(scoped_context.get("comparison_dimensions") or []),
                "applied_filters": list(scoped_context.get("applied_filters") or []),
                "time_context": scoped_context.get("time_context"),
                "period_context": scoped_context.get("period_context"),
                "notes": list(scoped_context.get("notes") or []),
            },
            "assumptions": list(workspace.get("assumptions") or []),
            "unknowns": unknowns,
            "readiness": readiness,
            "drafting": drafting,
            "created_at": workspace.get("created_at") or iso_timestamp(),
        }

    @staticmethod
    def _build_workspace_analysis(
        payload: Dict[str, Any],
        context: Dict[str, Any],
        workspace: Dict[str, Any],
        analysis_preferences: Dict[str, Any],
        generated_at: str,
    ) -> Tuple[Dict[str, Any], List[str]]:
        scoped_diagnostics = DecisionWorkspaceService._build_scoped_diagnostics(
            context=context,
            workspace=workspace,
            generated_at=generated_at,
        )
        legacy_diagnostics, legacy_warnings = DecisionWorkspaceService._build_secondary_legacy_diagnostics(
            payload=payload,
            workspace=workspace,
            analysis_preferences=analysis_preferences,
        )
        notes = [
            "This continuation path provides scoped observational diagnostics only.",
            "It does not execute simulation, trade-off analysis, or goal-seeking.",
        ]
        if legacy_diagnostics["status"] == "secondary":
            notes.append(
                "Legacy diagnostics were filtered to workspace-relevant metrics and dimensions so they remain additive evidence."
            )

        return (
            {
                "analysis_id": make_identifier("workspace_analysis", workspace.get("workspace_id"), generated_at),
                "analysis_mode": "scoped_observational",
                "status": workspace.get("status"),
                "summary": DecisionWorkspaceService._build_workspace_analysis_summary(
                    workspace=workspace,
                    scoped_diagnostics=scoped_diagnostics,
                    legacy_diagnostics=legacy_diagnostics,
                ),
                "truthfulness_note": "This response is descriptive and scope-grounded. It is not a simulation or trade-off result.",
                "scoped_diagnostics": scoped_diagnostics,
                "legacy_diagnostics": legacy_diagnostics,
                "notes": notes,
                "generated_at": generated_at,
            },
            legacy_warnings,
        )

    @staticmethod
    def _build_scoped_diagnostics(
        context: Dict[str, Any],
        workspace: Dict[str, Any],
        generated_at: str,
    ) -> List[Dict[str, Any]]:
        filters = list((workspace.get("scoped_context") or {}).get("applied_filters") or [])
        time_dimension = context.get("time_dimension")
        diagnostics: List[Dict[str, Any]] = []

        for item in DecisionWorkspaceService._collect_scoped_metric_refs(workspace):
            metric_ref = item["metric_ref"]
            metric = DecisionWorkspaceService._find_metric(context, metric_ref.get("metric_id"))
            diagnostic_id = make_identifier(
                "workspace_diagnostic",
                item["primary_role"],
                metric_ref.get("metric_id") or metric_ref.get("label"),
                generated_at,
            )
            if metric is None:
                diagnostics.append(
                    {
                        "diagnostic_id": diagnostic_id,
                        "diagnostic_type": "metric_observation",
                        "status": "metric_unavailable",
                        "focus_role": item["primary_role"],
                        "role_tags": item["roles"],
                        "metric_ref": metric_ref,
                        "summary": (
                            f"{metric_ref.get('label') or 'A scoped metric'} is part of this workspace, "
                            "but it is not available in the current semantic model."
                        ),
                        "time_context": None,
                        "period_context": None,
                        "evidence": None,
                    }
                )
                continue

            change = latest_metric_change(context, metric, filters=filters)
            if change is None:
                diagnostics.append(
                    {
                        "diagnostic_id": diagnostic_id,
                        "diagnostic_type": "metric_observation",
                        "status": "insufficient_history",
                        "focus_role": item["primary_role"],
                        "role_tags": item["roles"],
                        "metric_ref": build_metric_ref(metric),
                        "summary": (
                            f"{build_metric_ref(metric)['label']} is in scope, but the current dataset cannot produce "
                            "a reliable period-over-period comparison inside this workspace."
                        ),
                        "time_context": (workspace.get("scoped_context") or {}).get("time_context"),
                        "period_context": (workspace.get("scoped_context") or {}).get("period_context"),
                        "evidence": None,
                    }
                )
                continue

            time_context = build_time_context(change, time_dimension) if isinstance(time_dimension, dict) else None
            period_context = build_period_context(time_context)
            diagnostics.append(
                {
                    "diagnostic_id": diagnostic_id,
                    "diagnostic_type": "metric_observation",
                    "status": "observed_change",
                    "focus_role": item["primary_role"],
                    "role_tags": item["roles"],
                    "metric_ref": build_metric_ref(metric),
                    "summary": DecisionWorkspaceService._build_metric_change_summary(
                        metric_ref=build_metric_ref(metric),
                        change=change,
                        period_context=period_context,
                    ),
                    "time_context": time_context,
                    "period_context": period_context,
                    "evidence": {
                        "current_value": change.get("current_value"),
                        "previous_value": change.get("previous_value"),
                        "delta_value": change.get("delta_value"),
                        "delta_pct": change.get("delta_pct"),
                        "current_period": change.get("current_period"),
                        "previous_period": change.get("previous_period"),
                        "row_count": change.get("row_count"),
                    },
                }
            )

        return diagnostics

    @staticmethod
    def _collect_scoped_metric_refs(workspace: Dict[str, Any]) -> List[Dict[str, Any]]:
        decision_scope = workspace.get("decision_scope") if isinstance(workspace.get("decision_scope"), dict) else {}
        relevant_metrics = {
            item.get("metric_id"): item
            for item in (workspace.get("scoped_context") or {}).get("relevant_metrics") or []
            if isinstance(item, dict) and item.get("metric_id")
        }
        ordered: List[Dict[str, Any]] = []
        index_by_metric_id: Dict[str, int] = {}

        def add_metric(metric_ref: Optional[Dict[str, Any]], role: str) -> None:
            if not isinstance(metric_ref, dict):
                return
            metric_id = metric_ref.get("metric_id")
            if not metric_id:
                return
            if metric_id in index_by_metric_id:
                existing = ordered[index_by_metric_id[metric_id]]
                if role not in existing["roles"]:
                    existing["roles"].append(role)
                return
            index_by_metric_id[metric_id] = len(ordered)
            ordered.append(
                {
                    "metric_ref": metric_ref,
                    "primary_role": role,
                    "roles": [role],
                }
            )

        objective = decision_scope.get("objective") if isinstance(decision_scope.get("objective"), dict) else {}
        add_metric(objective.get("metric_ref"), "objective")
        for lever in decision_scope.get("levers") or []:
            binding = lever.get("binding") if isinstance(lever.get("binding"), dict) else {}
            add_metric(binding.get("metric_ref"), "lever")
        for constraint in decision_scope.get("constraints") or []:
            binding = constraint.get("binding") if isinstance(constraint.get("binding"), dict) else {}
            add_metric(binding.get("metric_ref"), "constraint")
        for metric_ref in relevant_metrics.values():
            add_metric(metric_ref, "context")
        return ordered

    @staticmethod
    def _build_metric_change_summary(
        metric_ref: Dict[str, Any],
        change: Dict[str, Any],
        period_context: Optional[Dict[str, Any]],
    ) -> str:
        label = metric_ref.get("label") or metric_ref.get("name") or "Scoped metric"
        current_value = change.get("current_value")
        previous_value = change.get("previous_value")
        delta_value = change.get("delta_value")
        delta_pct = change.get("delta_pct")
        window = describe_period_window(period_context)

        if delta_value == 0:
            return f"{label} held flat at {current_value} {window} within the scoped workspace."

        direction = "increased" if (delta_value or 0) > 0 else "decreased"
        if delta_pct is not None:
            percent_change = DecisionWorkspaceService._format_percent(abs(delta_pct))
            return (
                f"{label} {direction} by {percent_change} {window} within the scoped workspace "
                f"(from {previous_value} to {current_value})."
            )
        return f"{label} {direction} {window} within the scoped workspace (from {previous_value} to {current_value})."

    @staticmethod
    def _format_percent(value: Any) -> str:
        try:
            return f"{float(value) * 100:.1f}%"
        except (TypeError, ValueError):
            return "0.0%"

    @staticmethod
    def _build_secondary_legacy_diagnostics(
        payload: Dict[str, Any],
        workspace: Dict[str, Any],
        analysis_preferences: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], List[str]]:
        if (
            not analysis_preferences.get("include_secondary_legacy_diagnostics")
            or analysis_preferences.get("max_secondary_signals", 0) <= 0
        ):
            return {
                "status": "not_requested",
                "signals": [],
                "notes": ["Secondary legacy diagnostics were not requested for this workspace analysis run."],
            }, []

        relevant_metrics = [
            item.get("metric_id")
            for item in (workspace.get("scoped_context") or {}).get("relevant_metrics") or []
            if isinstance(item, dict) and item.get("metric_id")
        ]
        relevant_dimensions = {
            item.get("dimension_id")
            for collection_name in ("relevant_dimensions", "comparison_dimensions")
            for item in (workspace.get("scoped_context") or {}).get(collection_name) or []
            if isinstance(item, dict) and item.get("dimension_id")
        }
        if not relevant_metrics and not relevant_dimensions:
            return {
                "status": "not_applicable",
                "signals": [],
                "notes": ["No scoped metrics or dimensions were available for secondary legacy diagnostics."],
            }, []

        signal_payload = {
            "dataset": payload.get("dataset"),
            "dataset_ref": payload.get("dataset_ref") or payload.get("datasetRef"),
            "semantic_model": payload.get("semantic_model") or payload.get("semanticModel"),
            "filters": (workspace.get("scoped_context") or {}).get("applied_filters") or [],
            "metric_ids": relevant_metrics,
            "max_signals": max(analysis_preferences["max_secondary_signals"] * 2, 4),
        }
        signal_response = generate_decision_signals(signal_payload)
        signals = [
            signal
            for signal in signal_response.get("signals") or []
            if DecisionWorkspaceService._signal_matches_workspace_scope(signal, relevant_metrics, relevant_dimensions)
        ][: analysis_preferences["max_secondary_signals"]]

        status = "secondary" if signals else "no_scoped_matches"
        notes = [
            "Legacy signals were filtered to scoped metrics and dimensions before being attached to this workspace."
        ]
        if not signals:
            notes.append("No legacy signals matched the current workspace scope after filtering.")
        return {
            "status": status,
            "signals": signals,
            "notes": notes,
        }, list(signal_response.get("warnings") or [])

    @staticmethod
    def _signal_matches_workspace_scope(
        signal: Dict[str, Any],
        relevant_metric_ids: Sequence[str],
        relevant_dimension_ids: Sequence[str],
    ) -> bool:
        metric_ref = signal.get("metric_ref") if isinstance(signal.get("metric_ref"), dict) else {}
        if metric_ref.get("metric_id") in set(relevant_metric_ids):
            return True
        dimension_ref = signal.get("dimension_ref") if isinstance(signal.get("dimension_ref"), dict) else {}
        if dimension_ref.get("dimension_id") in set(relevant_dimension_ids):
            return True
        return False

    @staticmethod
    def _build_workspace_analysis_summary(
        workspace: Dict[str, Any],
        scoped_diagnostics: Sequence[Dict[str, Any]],
        legacy_diagnostics: Dict[str, Any],
    ) -> str:
        readiness = workspace.get("readiness") if isinstance(workspace.get("readiness"), dict) else {}
        missing_inputs = list(readiness.get("missing_inputs") or [])
        observed = next(
            (item for item in scoped_diagnostics if item.get("status") == "observed_change"),
            None,
        )
        if workspace.get("status") != "ready":
            missing_text = ", ".join(missing_inputs) if missing_inputs else "additional structural inputs"
            summary = (
                f"Workspace analysis remains {workspace.get('status')} because {missing_text} "
                "is still unresolved. Returned diagnostics are descriptive only."
            )
            if observed:
                summary += f" Latest scoped evidence: {observed.get('summary')}"
            return summary

        if observed:
            summary = f"Scoped analysis is anchored on the current workspace definition. {observed.get('summary')}"
        else:
            summary = (
                "Scoped analysis found no period-over-period metric evidence yet, but the workspace remains structurally ready."
            )

        if legacy_diagnostics.get("status") == "secondary" and legacy_diagnostics.get("signals"):
            summary += " Secondary legacy signals were attached as additive evidence only."
        return summary

    @staticmethod
    def _build_scoped_context(
        context: Dict[str, Any],
        objective: Dict[str, Any],
        levers: Sequence[Dict[str, Any]],
        constraints: Sequence[Dict[str, Any]],
        applied_filters: List[Dict[str, Any]],
        scope_preferences: Dict[str, Any],
    ) -> Dict[str, Any]:
        relevant_metrics: List[Dict[str, Any]] = []
        relevant_dimensions: List[Dict[str, Any]] = []
        comparison_dimensions: List[Dict[str, Any]] = []
        notes: List[str] = []
        seen_metric_ids = set()
        seen_dimension_ids = set()

        def add_metric(metric_ref: Optional[Dict[str, Any]], reason: str) -> None:
            if not isinstance(metric_ref, dict):
                return
            metric_id = metric_ref.get("metric_id")
            if not metric_id or metric_id in seen_metric_ids:
                return
            relevant_metrics.append(metric_ref)
            seen_metric_ids.add(metric_id)
            if reason:
                notes.append(reason)

        def add_dimension(dimension_ref: Optional[Dict[str, Any]], reason: str, for_comparison: bool = False) -> None:
            if not isinstance(dimension_ref, dict):
                return
            dimension_id = dimension_ref.get("dimension_id")
            if not dimension_id:
                return
            if dimension_id not in seen_dimension_ids:
                relevant_dimensions.append(dimension_ref)
                seen_dimension_ids.add(dimension_id)
                if reason:
                    notes.append(reason)
            if for_comparison and all(item.get("dimension_id") != dimension_id for item in comparison_dimensions):
                comparison_dimensions.append(dimension_ref)

        add_metric(
            objective.get("metric_ref"),
            f"Included {objective['metric_ref']['label']} as the objective anchor metric."
            if objective.get("metric_ref")
            else "",
        )

        for lever in levers:
            binding = lever.get("binding") if isinstance(lever.get("binding"), dict) else {}
            if binding.get("metric_ref"):
                add_metric(
                    binding.get("metric_ref"),
                    f"Included {binding['metric_ref']['label']} because it is directly bound to the lever '{lever['label']}'.",
                )
            if binding.get("dimension_ref"):
                add_dimension(
                    binding.get("dimension_ref"),
                    f"Included {binding['dimension_ref']['label']} because it is directly bound to the lever '{lever['label']}'.",
                    for_comparison=True,
                )

        for constraint in constraints:
            binding = constraint.get("binding") if isinstance(constraint.get("binding"), dict) else {}
            if binding.get("metric_ref"):
                add_metric(
                    binding.get("metric_ref"),
                    f"Included {binding['metric_ref']['label']} because it is directly bound to the constraint '{constraint['label']}'.",
                )
            if binding.get("dimension_ref"):
                add_dimension(
                    binding.get("dimension_ref"),
                    f"Included {binding['dimension_ref']['label']} because it is directly bound to the constraint '{constraint['label']}'.",
                    for_comparison=True,
                )

        for filter_def in applied_filters:
            dimension = DecisionWorkspaceService._find_dimension_by_field(context, filter_def.get("field"))
            if dimension:
                dimension_ref = build_dimension_ref(dimension)
                add_dimension(
                    dimension_ref,
                    f"Included {dimension_ref['label']} because it is used in the applied workspace filters.",
                    for_comparison=True,
                )

        anchor_metric = DecisionWorkspaceService._find_metric(
            context,
            (objective.get("metric_ref") or {}).get("metric_id"),
        )
        if anchor_metric is None and relevant_metrics:
            anchor_metric = DecisionWorkspaceService._find_metric(context, relevant_metrics[0].get("metric_id"))

        if anchor_metric is not None:
            breakdown_dimensions = select_breakdown_dimensions(
                context=context,
                metric=anchor_metric,
                max_dimensions=scope_preferences["max_candidate_dimensions"],
                exclude_fields=[filter_def.get("field") for filter_def in applied_filters if filter_def.get("field")],
            )
            for dimension in breakdown_dimensions:
                dimension_ref = build_dimension_ref(dimension)
                anchor_label = build_metric_ref(anchor_metric)["label"]
                add_dimension(
                    dimension_ref,
                    f"Included {dimension_ref['label']} as a comparison dimension compatible with {anchor_label}.",
                    for_comparison=True,
                )

        metric_limit = scope_preferences["max_candidate_metrics"]
        if len(relevant_metrics) > metric_limit:
            relevant_metrics = relevant_metrics[:metric_limit]
            notes.append(
                f"Scoped metrics were capped at {metric_limit} items based on scope_preferences.max_candidate_metrics."
            )

        dimension_limit = scope_preferences["max_candidate_dimensions"]
        if len(relevant_dimensions) > dimension_limit:
            allowed_dimension_ids = {
                item.get("dimension_id")
                for item in relevant_dimensions[:dimension_limit]
                if isinstance(item, dict) and item.get("dimension_id")
            }
            relevant_dimensions = relevant_dimensions[:dimension_limit]
            comparison_dimensions = [
                item for item in comparison_dimensions if item.get("dimension_id") in allowed_dimension_ids
            ]
            notes.append(
                f"Scoped dimensions were capped at {dimension_limit} items based on scope_preferences.max_candidate_dimensions."
            )

        comparison_dimensions = DecisionWorkspaceService._dedupe_refs(comparison_dimensions)[: min(3, dimension_limit)]
        time_context, period_context, time_notes = DecisionWorkspaceService._resolve_time_and_period_context(
            context=context,
            objective=objective,
            relevant_metrics=relevant_metrics,
            applied_filters=applied_filters,
        )
        notes.extend(time_notes)

        if not relevant_metrics:
            notes.append(
                "No scoped metrics were auto-filled from the broader dataset because DI 2.0 keeps decision scoping honest."
            )
        notes.append(
            "Legacy decision-bundle diagnostics remain available through /api/decision/run but were not used to define this scoped workspace."
        )
        if scope_preferences.get("include_diagnostics"):
            notes.append(
                "Supplemental diagnostics were intentionally kept secondary so ranked dataset-wide signals do not replace the scoped decision model."
            )

        return {
            "relevant_metrics": relevant_metrics,
            "relevant_dimensions": relevant_dimensions,
            "comparison_dimensions": comparison_dimensions,
            "applied_filters": applied_filters,
            "time_context": time_context,
            "period_context": period_context,
            "notes": DecisionWorkspaceService._dedupe_strings(notes),
        }

    @staticmethod
    def _resolve_time_and_period_context(
        context: Dict[str, Any],
        objective: Dict[str, Any],
        relevant_metrics: Sequence[Dict[str, Any]],
        applied_filters: Sequence[Dict[str, Any]],
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], List[str]]:
        notes: List[str] = []
        time_dimension = context.get("time_dimension")
        if not isinstance(time_dimension, dict):
            return None, None, notes

        metric_candidates: List[Dict[str, Any]] = []
        objective_metric = DecisionWorkspaceService._find_metric(
            context,
            (objective.get("metric_ref") or {}).get("metric_id"),
        )
        if objective_metric is not None:
            metric_candidates.append(objective_metric)
        for metric_ref in relevant_metrics:
            metric = DecisionWorkspaceService._find_metric(context, metric_ref.get("metric_id"))
            if metric is not None and metric not in metric_candidates:
                metric_candidates.append(metric)

        for metric in metric_candidates:
            change = latest_metric_change(context, metric, filters=applied_filters)
            if change is None:
                continue
            time_context = build_time_context(change, time_dimension)
            period_context = build_period_context(time_context)
            notes.append(
                f"Time context was anchored on the latest observed change for {build_metric_ref(metric)['label']}."
            )
            return time_context, period_context, notes

        filtered_df = DecisionWorkspaceService._filter_dataframe(context["dataframe"], applied_filters)
        time_context = DecisionWorkspaceService._time_context_from_dataframe(filtered_df, time_dimension)
        if time_context is not None:
            notes.append(
                f"Time context fell back to the scoped dataset slice on {time_dimension.get('label') or time_dimension.get('field')} because no metric-period comparison was available."
            )
            return time_context, build_period_context(time_context), notes

        horizon_context = DecisionWorkspaceService._time_context_from_horizon(
            objective.get("time_horizon"),
            time_dimension,
        )
        if horizon_context is not None:
            notes.append(
                "Time context was derived from the objective time horizon because the dataset could not provide an observed scoped comparison."
            )
            return horizon_context, build_period_context(horizon_context), notes

        return None, None, notes

    @staticmethod
    def _filter_dataframe(dataframe: pd.DataFrame, filters: Sequence[Dict[str, Any]]) -> pd.DataFrame:
        if dataframe.empty or not filters:
            return dataframe
        try:
            return MetricResolver._apply_filters(dataframe, filters)
        except MetricResolutionError:
            return dataframe

    @staticmethod
    def _time_context_from_dataframe(
        dataframe: pd.DataFrame,
        time_dimension: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        field = time_dimension.get("field")
        if not field or field not in dataframe.columns:
            return None

        temporal_series = pd.to_datetime(dataframe[field], errors="coerce").dropna()
        if temporal_series.empty:
            return None

        unique_values = pd.Series(temporal_series.unique()).sort_values()
        current_value = unique_values.iloc[-1]
        previous_value = unique_values.iloc[-2] if len(unique_values.index) > 1 else None
        return build_time_context(
            {
                "current_period": current_value,
                "previous_period": previous_value,
            },
            time_dimension,
        )

    @staticmethod
    def _time_context_from_horizon(
        time_horizon: Optional[Dict[str, Any]],
        time_dimension: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(time_horizon, dict):
            return None

        current_value = time_horizon.get("end") or time_horizon.get("label")
        previous_value = time_horizon.get("start")
        if current_value is None and previous_value is None:
            return None

        return {
            "dimension_id": time_dimension.get("id"),
            "field": time_dimension.get("field"),
            "grain": time_horizon.get("grain"),
            "current_value": current_value,
            "previous_value": previous_value,
        }

    @staticmethod
    def _generate_assumptions(
        objective: Dict[str, Any],
        levers: Sequence[Dict[str, Any]],
        constraints: Sequence[Dict[str, Any]],
        scoped_context: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        assumptions: List[Dict[str, Any]] = []
        time_horizon = objective.get("time_horizon")
        if isinstance(time_horizon, dict):
            assumptions.append(
                {
                    "assumption_id": make_identifier("assumption", "time_horizon", time_horizon.get("label")),
                    "label": f"The decision should be interpreted within the '{time_horizon.get('label')}' horizon.",
                    "category": "timeframe",
                    "status": "active",
                    "materiality": "medium",
                }
            )

        if any((lever.get("binding") or {}).get("binding_type") == "field" for lever in levers):
            assumptions.append(
                {
                    "assumption_id": make_identifier("assumption", "lever_field_bindings"),
                    "label": "At least one lever is bound directly to a raw dataset field rather than a dedicated semantic object.",
                    "category": "scope",
                    "status": "active",
                    "materiality": "medium",
                }
            )

        if any(
            (constraint.get("binding") or {}).get("binding_type") == "field"
            for constraint in constraints
            if str(constraint.get("hardness") or "").strip().lower() == "hard"
        ):
            assumptions.append(
                {
                    "assumption_id": make_identifier("assumption", "hard_constraint_field_bindings"),
                    "label": "At least one hard constraint relies on a raw field binding rather than a semantic metric.",
                    "category": "data",
                    "status": "active",
                    "materiality": "medium",
                }
            )

        if scoped_context.get("time_context") is None and time_horizon:
            assumptions.append(
                {
                    "assumption_id": make_identifier("assumption", "time_context_unavailable"),
                    "label": "The workspace horizon is defined by the objective even though the dataset could not provide a stronger scoped temporal comparison.",
                    "category": "timeframe",
                    "status": "active",
                    "materiality": "high",
                }
            )

        return assumptions

    @staticmethod
    def _generate_unknowns(
        objective: Dict[str, Any],
        levers: Sequence[Dict[str, Any]],
        constraints: Sequence[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        unknowns: List[Dict[str, Any]] = []

        if objective.get("resolution_status") != "resolved":
            objective_reason = objective.get("reason") or "The workspace objective is not fully resolved."
            unknowns.append(
                {
                    "unknown_id": make_identifier("unknown", "objective", objective.get("objective_id")),
                    "label": objective_reason,
                    "category": "binding_gap",
                    "severity": "high",
                    "blocks_simulation": True,
                }
            )

        controllable_levers = [lever for lever in levers if lever.get("controllable")]
        usable_levers = [
            lever
            for lever in controllable_levers
            if (lever.get("binding") or {}).get("status") in {"resolved", "partial"}
        ]

        if not controllable_levers:
            unknowns.append(
                {
                    "unknown_id": make_identifier("unknown", "no_controllable_lever"),
                    "label": "At least one controllable lever is required before the workspace can represent a real decision.",
                    "category": "modeling_gap",
                    "severity": "high",
                    "blocks_simulation": True,
                }
            )

        for lever in controllable_levers:
            binding = lever.get("binding") if isinstance(lever.get("binding"), dict) else {}
            status = binding.get("status")
            if status == "resolved":
                continue

            unknowns.append(
                {
                    "unknown_id": make_identifier("unknown", "lever", lever.get("lever_id")),
                    "label": f"Lever '{lever['label']}' is not fully resolved: {binding.get('reason') or 'No binding is available yet.'}",
                    "category": "binding_gap",
                    "severity": "high" if status == "unresolved" and not usable_levers else "medium",
                    "blocks_simulation": bool(status == "unresolved" and not usable_levers),
                }
            )

        for lever in levers:
            if lever.get("controllable"):
                continue
            unknowns.append(
                {
                    "unknown_id": make_identifier("unknown", "lever_not_controllable", lever.get("lever_id")),
                    "label": f"Lever '{lever['label']}' is marked as not controllable and may belong in business context rather than the action set.",
                    "category": "modeling_gap",
                    "severity": "medium",
                    "blocks_simulation": False,
                }
            )

        for constraint in constraints:
            is_hard = str(constraint.get("hardness") or "").strip().lower() == "hard"
            if DecisionWorkspaceService._is_constraint_structurally_valid(constraint):
                continue

            binding = constraint.get("binding") if isinstance(constraint.get("binding"), dict) else {}
            unknowns.append(
                {
                    "unknown_id": make_identifier("unknown", "constraint", constraint.get("constraint_id")),
                    "label": (
                        f"Hard constraint '{constraint['label']}' is not structurally valid yet: "
                        f"{binding.get('reason') or 'The constraint needs a valid binding or clearer structure.'}"
                    )
                    if is_hard
                    else f"Constraint '{constraint['label']}' is only partially defined: {binding.get('reason') or 'The constraint needs clearer structure.'}",
                    "category": "constraint_gap",
                    "severity": "high" if is_hard else "medium",
                    "blocks_simulation": bool(is_hard),
                }
            )

        return unknowns

    @staticmethod
    def _evaluate_readiness(
        objective: Dict[str, Any],
        levers: Sequence[Dict[str, Any]],
        constraints: Sequence[Dict[str, Any]],
        unknowns: Sequence[Dict[str, Any]],
    ) -> Dict[str, Any]:
        controllable_levers = [lever for lever in levers if lever.get("controllable")]
        usable_levers = [
            lever
            for lever in controllable_levers
            if (lever.get("binding") or {}).get("status") in {"resolved", "partial"}
        ]
        resolved_levers = [
            lever for lever in controllable_levers if (lever.get("binding") or {}).get("status") == "resolved"
        ]
        hard_constraints = [
            constraint
            for constraint in constraints
            if str(constraint.get("hardness") or "").strip().lower() == "hard"
        ]

        objective_ready = objective.get("resolution_status") == "resolved"
        lever_ready = bool(usable_levers)
        constraint_ready = all(
            DecisionWorkspaceService._is_constraint_structurally_valid(constraint)
            for constraint in hard_constraints
        )
        scope_complete = bool(objective.get("statement")) and bool(controllable_levers)

        missing_inputs: List[str] = []
        if not objective_ready:
            missing_inputs.append("objective.metric_id_or_metric_name")
        if not controllable_levers:
            missing_inputs.append("at_least_one_controllable_lever")
        if not resolved_levers:
            missing_inputs.append("at_least_one_resolved_lever")

        for constraint in hard_constraints:
            if DecisionWorkspaceService._is_constraint_structurally_valid(constraint):
                continue
            constraint_key = constraint.get("constraint_id") or make_identifier("constraint", constraint.get("label"))
            missing_inputs.append(f"constraints.{constraint_key}.binding")

        can_run_simulation = (
            objective_ready
            and bool(resolved_levers)
            and constraint_ready
            and not any(bool(item.get("blocks_simulation")) for item in unknowns)
        )

        return {
            "scope_complete": scope_complete,
            "objective_ready": objective_ready,
            "lever_ready": lever_ready,
            "constraint_ready": constraint_ready,
            "can_run_simulation": can_run_simulation,
            "missing_inputs": missing_inputs,
        }

    @staticmethod
    def _derive_workspace_status(readiness: Dict[str, Any]) -> str:
        if not readiness.get("scope_complete"):
            return "needs_input"
        if (
            readiness.get("objective_ready")
            and readiness.get("lever_ready")
            and readiness.get("constraint_ready")
            and not readiness.get("missing_inputs")
        ):
            return "ready"
        return "limited"

    @staticmethod
    def _is_constraint_structurally_valid(constraint: Dict[str, Any]) -> bool:
        condition = constraint.get("condition")
        if not isinstance(condition, dict):
            return False

        binding = constraint.get("binding") if isinstance(constraint.get("binding"), dict) else {}
        if binding.get("status") == "resolved":
            return True

        constraint_type = str(constraint.get("constraint_type") or "").strip().lower()
        if constraint_type in {"custom", "time_limit", "operating_limit", "capacity_limit", "policy_rule"}:
            return True

        return False

    @staticmethod
    def _generate_title(objective: Dict[str, Any]) -> str:
        statement = str(objective.get("statement") or "").strip()
        return statement if statement else "Scoped decision workspace"

    @staticmethod
    def _generate_scope_summary(
        objective: Dict[str, Any],
        levers: Sequence[Dict[str, Any]],
        constraints: Sequence[Dict[str, Any]],
    ) -> str:
        lever_labels = [lever.get("label") for lever in levers if lever.get("label")]
        hard_constraints = [
            constraint.get("label")
            for constraint in constraints
            if constraint.get("label") and str(constraint.get("hardness") or "").strip().lower() == "hard"
        ]

        summary = f"This workspace is anchored on the objective '{objective.get('statement')}'."
        if lever_labels:
            summary += f" Candidate levers include {', '.join(lever_labels[:3])}."
        if len(lever_labels) > 3:
            summary += f" {len(lever_labels) - 3} additional levers were supplied."
        if hard_constraints:
            summary += f" Hard guardrails include {', '.join(hard_constraints[:2])}."
        elif constraints:
            summary += " Constraints were provided, but none are currently hard guardrails."
        else:
            summary += " No constraints were declared yet."
        return summary

    @staticmethod
    def _find_metric(context: Dict[str, Any], reference: Any) -> Optional[Dict[str, Any]]:
        normalized_reference = DecisionWorkspaceService._normalize_text(reference)
        if not normalized_reference:
            return None
        for metric in context.get("metrics", []):
            if DecisionWorkspaceService._candidate_matches(metric, normalized_reference, ("id", "metric_id", "name", "label", "field")):
                return metric
        return None

    @staticmethod
    def _find_metric_by_field(context: Dict[str, Any], field: str) -> Optional[Dict[str, Any]]:
        matches = [
            metric
            for metric in context.get("metrics", [])
            if DecisionWorkspaceService._normalize_text(metric.get("field")) == field
        ]
        if len(matches) == 1:
            return matches[0]
        return None

    @staticmethod
    def _find_dimension(context: Dict[str, Any], reference: Any) -> Optional[Dict[str, Any]]:
        normalized_reference = DecisionWorkspaceService._normalize_text(reference)
        if not normalized_reference:
            return None
        for dimension in context.get("dimensions", []):
            if DecisionWorkspaceService._candidate_matches(dimension, normalized_reference, ("id", "dimension_id", "name", "label", "field")):
                return dimension
        return None

    @staticmethod
    def _find_dimension_by_field(context: Dict[str, Any], field: Any) -> Optional[Dict[str, Any]]:
        normalized_field = DecisionWorkspaceService._normalize_text(field)
        if not normalized_field:
            return None
        for dimension in context.get("dimensions", []):
            if DecisionWorkspaceService._normalize_text(dimension.get("field")) == normalized_field:
                return dimension
        return None

    @staticmethod
    def _candidate_matches(candidate: Dict[str, Any], reference: str, keys: Sequence[str]) -> bool:
        for key in keys:
            if DecisionWorkspaceService._normalize_text(candidate.get(key)) == reference:
                return True
        return False

    @staticmethod
    def _normalize_text(value: Any) -> Optional[str]:
        text = str(value or "").strip()
        return text.lower() if text else None

    @staticmethod
    def _dedupe_refs(items: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
        ordered: List[Dict[str, Any]] = []
        seen = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            identifier = item.get("metric_id") or item.get("dimension_id")
            if not identifier or identifier in seen:
                continue
            seen.add(identifier)
            ordered.append(item)
        return ordered

    @staticmethod
    def _dedupe_strings(items: Sequence[str]) -> List[str]:
        ordered: List[str] = []
        for item in items:
            text = str(item or "").strip()
            if text and text not in ordered:
                ordered.append(text)
        return ordered
