"""Conservative advanced-capability readiness diagnostics for Decision Output.

The service evaluates whether the current, source-backed decision context is
trustworthy enough to *attempt* an advanced workflow. It never runs a model,
estimates an effect, optimizes an action, or makes a decision.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class AdvancedReadinessService:
    """Build a stable, display-ready trust-gate contract for AI Chat."""

    SCHEMA_VERSION = "di_advanced_readiness_v1"
    TRUTH_BOUNDARY = "observational_analysis_only"
    VALID_STATES = {"supported", "limited", "blocked", "not_evaluated"}
    MINIMUM_MODEL_ROWS = 10

    @classmethod
    def evaluate(
        cls,
        *,
        frame: Dict[str, Any],
        dataset_trust: Dict[str, Any],
        decision_readiness: Dict[str, Any],
        evidence_board: Dict[str, Any],
        governance_readiness: Optional[Dict[str, Any]] = None,
        model_evaluation: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Classify advanced capabilities using only supplied backend evidence.

        ``model_evaluation`` is intentionally an internal, optional input. A
        future trusted backend caller may supply a validated model-run result;
        arbitrary chat payload fields are not promoted to supported evidence.
        """

        frame = frame if isinstance(frame, dict) else {}
        dataset_trust = dataset_trust if isinstance(dataset_trust, dict) else {}
        decision_readiness = decision_readiness if isinstance(decision_readiness, dict) else {}
        evidence_board = evidence_board if isinstance(evidence_board, dict) else {}
        governance_readiness = (
            governance_readiness if isinstance(governance_readiness, dict) else None
        )
        model_evaluation = model_evaluation if isinstance(model_evaluation, dict) else None

        capabilities = [
            cls._prediction_readiness(
                frame=frame,
                dataset_trust=dataset_trust,
                governance_readiness=governance_readiness,
                model_evaluation=model_evaluation,
            ),
            cls._optimization_readiness(decision_readiness),
            cls._causal_readiness(evidence_board),
            cls._automated_decisioning_readiness(decision_readiness),
        ]
        counts = {
            state: sum(item["state"] == state for item in capabilities)
            for state in ("supported", "limited", "blocked", "not_evaluated")
        }
        overall_state = cls._overall_state(counts)

        return {
            "schema_version": cls.SCHEMA_VERSION,
            "overall_state": overall_state,
            "summary": cls._overall_summary(overall_state, counts),
            "capabilities": capabilities,
            "state_counts": counts,
            "limitations": [
                "These diagnostics assess readiness only; they do not produce predictions, simulations, optimized actions, causal proof, or autonomous decisions.",
                "A supported readiness state means prerequisites were evidenced, not that future model performance or business outcomes are guaranteed.",
            ],
            "truth_boundary": cls.TRUTH_BOUNDARY,
        }

    @classmethod
    def _prediction_readiness(
        cls,
        *,
        frame: Dict[str, Any],
        dataset_trust: Dict[str, Any],
        governance_readiness: Optional[Dict[str, Any]],
        model_evaluation: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        dataset = dataset_trust.get("dataset") if isinstance(dataset_trust.get("dataset"), dict) else None
        row_count = cls._non_negative_int(dataset_trust.get("row_count"))
        semantic_ready = dataset_trust.get("semantic_ready") is True
        goal = frame.get("goal") if isinstance(frame.get("goal"), dict) else {}
        metric_ref = goal.get("metric_ref") if isinstance(goal.get("metric_ref"), dict) else {}
        target_label = str(
            metric_ref.get("field")
            or metric_ref.get("label")
            or metric_ref.get("name")
            or ""
        ).strip()
        governance_status = str(
            (governance_readiness or {}).get("status") or "not_evaluated"
        ).strip().lower()
        governance_verified = governance_status in {"ready", "warning"}

        evidence: List[Dict[str, Any]] = [
            cls._evidence("dataset_rows", "Dataset rows", row_count, "decision_output.dataset_trust.row_count"),
            cls._evidence(
                "semantic_readiness",
                "Semantic context ready",
                semantic_ready,
                "decision_output.dataset_trust.semantic_ready",
            ),
            cls._evidence(
                "governance_status",
                "Governance status",
                governance_status,
                "governance_readiness.status",
            ),
        ]
        if target_label:
            evidence.append(
                cls._evidence(
                    "prediction_target_candidate",
                    "Target candidate",
                    target_label,
                    "decision_output.frame.goal.metric_ref",
                )
            )

        if dataset is None or row_count == 0:
            return cls._capability(
                capability="prediction",
                state="not_evaluated",
                reason_code="dataset_not_available",
                reason="Prediction readiness was not evaluated because no usable dataset is attached to this decision output.",
                evidence=evidence,
                missing_requirements=[
                    cls._requirement("usable_dataset", "Attach a governed dataset with usable rows and columns."),
                    cls._requirement("prediction_target", "Identify the outcome field the model would predict."),
                ],
                allowed_next_actions=[
                    cls._action("attach_dataset", "Attach a dataset", "Provide the dataset that should be evaluated for prediction readiness."),
                ],
            )

        if governance_status == "blocked":
            return cls._capability(
                capability="prediction",
                state="blocked",
                reason_code="governance_blocked",
                reason="Prediction readiness is blocked because dataset governance rejected the current data.",
                evidence=evidence,
                missing_requirements=cls._governance_requirements(governance_readiness),
                allowed_next_actions=[
                    cls._action("resolve_governance_blockers", "Resolve governance blockers", "Apply the exact remedies returned by governance_readiness before model preparation."),
                ],
            )

        if not semantic_ready or not target_label:
            missing = []
            if not semantic_ready:
                missing.append(cls._requirement("semantic_context", "Confirm metric or dimension semantics for the dataset."))
            if not target_label:
                missing.append(cls._requirement("prediction_target", "Bind the decision goal to a concrete target field."))
            return cls._capability(
                capability="prediction",
                state="blocked",
                reason_code="target_or_semantics_missing",
                reason="Prediction readiness is blocked until the target and its semantic meaning are explicit.",
                evidence=evidence,
                missing_requirements=missing,
                allowed_next_actions=[
                    cls._action("review_semantic_model", "Review semantic roles", "Confirm the target metric and its backing field before model preparation."),
                ],
            )

        if row_count < cls.MINIMUM_MODEL_ROWS:
            return cls._capability(
                capability="prediction",
                state="blocked",
                reason_code="insufficient_training_rows",
                reason=(
                    f"Prediction readiness is blocked because only {row_count} usable rows are evidenced; "
                    f"the current training runtime requires at least {cls.MINIMUM_MODEL_ROWS}."
                ),
                evidence=evidence,
                missing_requirements=[
                    cls._requirement(
                        "minimum_training_rows",
                        f"Provide at least {cls.MINIMUM_MODEL_ROWS} non-null target rows before model training.",
                    )
                ],
                allowed_next_actions=[
                    cls._action("add_training_history", "Add training history", "Provide more target-bearing observations, then rerun ML preparation checks."),
                ],
            )

        if governance_verified and cls._validated_model_matches(model_evaluation, target_label):
            evidence.extend(cls._model_evidence(model_evaluation or {}))
            return cls._capability(
                capability="prediction",
                state="supported",
                reason_code="validated_model_evidence_available",
                reason="Prediction prerequisites are supported by a target-matched backend model evaluation and governed dataset evidence.",
                evidence=evidence,
                missing_requirements=[],
                allowed_next_actions=[
                    cls._action("review_model_evaluation", "Review model evaluation", "Inspect holdout metrics, baseline comparison, warnings, and intended-use limits before any prediction use."),
                ],
            )

        missing_requirements = []
        if not governance_verified:
            missing_requirements.append(
                cls._requirement(
                    "governance_evaluation",
                    "Run the dataset governance gate and retain its verified ready or warning result.",
                )
            )
        missing_requirements.extend([
            cls._requirement("ml_preparation_check", "Run model-specific ML preparation checks for the selected target."),
            cls._requirement("validated_model_run", "Train and evaluate a model against a baseline and holdout set."),
        ])
        return cls._capability(
            capability="prediction",
            state="limited",
            reason_code="model_validation_not_available",
            reason="The data and target can proceed to model preparation, but no target-matched validated model run is attached to this decision output.",
            evidence=evidence,
            missing_requirements=missing_requirements,
            allowed_next_actions=[
                cls._action("review_ml_preparation", "Review ML preparation", "Run the backend ML preparation check for the intended model and target."),
                cls._action("train_and_validate_model", "Train and validate a model", "Use the governed ML or AutoML path and inspect baseline-relative holdout metrics."),
            ],
        )

    @classmethod
    def _optimization_readiness(cls, decision_readiness: Dict[str, Any]) -> Dict[str, Any]:
        capability_state = decision_readiness.get("capability_state") if isinstance(decision_readiness.get("capability_state"), dict) else {}
        runtime_state = capability_state.get("optimization") if isinstance(capability_state.get("optimization"), dict) else {}
        return cls._capability(
            capability="optimization",
            state="blocked",
            reason_code="optimization_runtime_not_supported",
            reason="Optimization readiness is blocked because the current decision runtime does not implement a goal-seeking optimizer.",
            evidence=[
                cls._evidence("runtime_status", "Runtime status", runtime_state.get("status") or "unsupported", "decision_output.readiness.capability_state.optimization.status"),
                cls._evidence("truth_boundary", "Truth boundary", cls.TRUTH_BOUNDARY, "decision_output.readiness.truth_boundary"),
            ],
            missing_requirements=[
                cls._requirement("optimization_runtime", "Implement and validate a bounded optimization runtime."),
                cls._requirement("objective_and_constraints", "Define a machine-evaluable objective, controllable variables, constraints, and safety limits."),
            ],
            allowed_next_actions=[
                cls._action("review_observational_evidence", "Review observational evidence", "Use current evidence to refine objective and constraint definitions without claiming an optimum."),
            ],
        )

    @classmethod
    def _causal_readiness(cls, evidence_board: Dict[str, Any]) -> Dict[str, Any]:
        return cls._capability(
            capability="causal_analysis",
            state="blocked",
            reason_code="causal_method_not_supported",
            reason="Causal analysis is blocked because current evidence is observational and no validated causal identification method is implemented.",
            evidence=[
                cls._evidence("evidence_status", "Evidence Board status", evidence_board.get("status") or "not_analyzed", "decision_output.evidence_board.status"),
                cls._evidence("observational_boundary", "Evidence boundary", evidence_board.get("observational_boundary") or cls.TRUTH_BOUNDARY, "decision_output.evidence_board.observational_boundary"),
            ],
            missing_requirements=[
                cls._requirement("treatment_and_outcome", "Define treatment, outcome, timing, and population."),
                cls._requirement("identification_strategy", "Provide a defensible experiment or causal identification strategy with confounder controls."),
                cls._requirement("causal_validation", "Implement diagnostics that test assumptions and uncertainty before estimating effects."),
            ],
            allowed_next_actions=[
                cls._action("document_causal_hypothesis", "Document a causal hypothesis", "Record the proposed relationship as an unvalidated hypothesis for study design."),
                cls._action("inspect_observed_associations", "Inspect observed associations", "Review non-causal evidence and explicitly preserve the observational boundary."),
            ],
        )

    @classmethod
    def _automated_decisioning_readiness(cls, decision_readiness: Dict[str, Any]) -> Dict[str, Any]:
        capability_state = decision_readiness.get("capability_state") if isinstance(decision_readiness.get("capability_state"), dict) else {}
        runtime_state = capability_state.get("autonomous_decisioning") if isinstance(capability_state.get("autonomous_decisioning"), dict) else {}
        return cls._capability(
            capability="automated_decisioning",
            state="blocked",
            reason_code="human_decision_required",
            reason="Automated decisioning is blocked because the system provides observational decision support and does not make autonomous decisions.",
            evidence=[
                cls._evidence("runtime_status", "Runtime status", runtime_state.get("status") or "unsupported", "decision_output.readiness.capability_state.autonomous_decisioning.status"),
                cls._evidence("truth_boundary", "Truth boundary", cls.TRUTH_BOUNDARY, "decision_output.truth_boundary"),
            ],
            missing_requirements=[
                cls._requirement("approved_automation_policy", "Define approved actions, human approval points, rollback rules, monitoring, and audit ownership."),
                cls._requirement("validated_upstream_capabilities", "Validate every predictive, causal, and optimization dependency before considering automation."),
            ],
            allowed_next_actions=[
                cls._action("keep_human_approval", "Keep human approval", "Use AI Chat output as review evidence while a person remains responsible for every decision."),
            ],
        )

    @classmethod
    def _capability(
        cls,
        *,
        capability: str,
        state: str,
        reason_code: str,
        reason: str,
        evidence: List[Dict[str, Any]],
        missing_requirements: List[Dict[str, str]],
        allowed_next_actions: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        if state not in cls.VALID_STATES:
            state = "not_evaluated"
        return {
            "capability": capability,
            "state": state,
            "reasons": [{"code": reason_code, "message": reason}],
            "evidence": evidence,
            "missing_requirements": missing_requirements,
            "allowed_next_actions": allowed_next_actions,
            "truth_boundary": cls.TRUTH_BOUNDARY,
        }

    @staticmethod
    def _evidence(code: str, label: str, value: Any, source_path: str) -> Dict[str, Any]:
        return {"code": code, "label": label, "value": value, "source_path": source_path}

    @staticmethod
    def _requirement(requirement_id: str, description: str) -> Dict[str, str]:
        return {"requirement_id": requirement_id, "description": description}

    @staticmethod
    def _action(action_id: str, label: str, description: str) -> Dict[str, str]:
        return {"action_id": action_id, "label": label, "description": description}

    @classmethod
    def _governance_requirements(cls, readiness: Optional[Dict[str, Any]]) -> List[Dict[str, str]]:
        reasons = (readiness or {}).get("reasons")
        requirements = []
        for index, reason in enumerate(reasons if isinstance(reasons, list) else []):
            if not isinstance(reason, dict):
                continue
            description = str(reason.get("next_action") or reason.get("message") or "").strip()
            if description:
                requirements.append(cls._requirement(str(reason.get("code") or f"governance_{index + 1}"), description))
        return requirements or [
            cls._requirement("governance_clearance", "Resolve dataset governance blockers before model preparation.")
        ]

    @staticmethod
    def _non_negative_int(value: Any) -> int:
        if isinstance(value, bool):
            return 0
        try:
            return max(int(value), 0)
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _validated_model_matches(model_evaluation: Optional[Dict[str, Any]], target_label: str) -> bool:
        if not isinstance(model_evaluation, dict):
            return False
        status = str(model_evaluation.get("status") or "").strip().lower()
        run_id = str(model_evaluation.get("run_id") or "").strip()
        target = str(model_evaluation.get("target_column") or "").strip().lower()
        metrics = model_evaluation.get("metrics")
        return (
            status == "validated"
            and bool(run_id)
            and target == target_label.strip().lower()
            and isinstance(metrics, dict)
            and bool(metrics)
        )

    @classmethod
    def _model_evidence(cls, model_evaluation: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            cls._evidence("validated_model_run", "Validated model run", model_evaluation.get("run_id"), "model_evaluation.run_id"),
            cls._evidence("model_problem_type", "Problem type", model_evaluation.get("problem_type") or "unknown", "model_evaluation.problem_type"),
            cls._evidence("model_metrics_available", "Holdout metrics available", True, "model_evaluation.metrics"),
        ]

    @staticmethod
    def _overall_state(counts: Dict[str, int]) -> str:
        if counts.get("supported") == sum(counts.values()):
            return "supported"
        if counts.get("limited") or counts.get("supported"):
            return "limited"
        if counts.get("blocked"):
            return "blocked"
        return "not_evaluated"

    @staticmethod
    def _overall_summary(overall_state: str, counts: Dict[str, int]) -> str:
        return (
            f"Advanced readiness is {overall_state}: {counts.get('supported', 0)} supported, "
            f"{counts.get('limited', 0)} limited, {counts.get('blocked', 0)} blocked, and "
            f"{counts.get('not_evaluated', 0)} not evaluated. Review each capability's evidence and missing requirements before proceeding."
        )
