"""Shared governance helpers for primary BI chat and optional compatibility routes."""

from flask import jsonify

from backend.services.data_catalog_lineage import (
    GovernancePolicyError,
    evaluate_dataset_readiness,
    governance_error_payload,
    is_blocked,
)
from backend.services.dataset_context import resolve_dataset_bundle


def error_payload(code: str, message: str):
    """Return the stable error envelope shared by decision-prefixed APIs."""
    return {
        "status": "error",
        "error": {
            "code": code,
            "message": message,
        },
    }


def governance_for_payload(payload, operation):
    """Evaluate governed data only when the request actually carries a dataset."""
    multi_source_readiness = (
        payload.get("_multi_source_governance_readiness")
        if isinstance(payload, dict)
        else None
    )
    if isinstance(multi_source_readiness, dict):
        if is_blocked(multi_source_readiness):
            return multi_source_readiness, (
                jsonify(governance_error_payload(multi_source_readiness)),
                422,
            )
        return multi_source_readiness, None
    if not isinstance(payload, dict) or (
        payload.get("dataset") is None
        and not (payload.get("dataset_ref") or payload.get("datasetRef"))
    ):
        return None, None
    try:
        bundle = resolve_dataset_bundle(
            dataset=payload.get("dataset"),
            dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
            semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
            source=f"decision_{operation}",
            allow_active_fallback=False,
        )
        readiness = evaluate_dataset_readiness(
            bundle["dataframe"],
            payload.get("governance_policy")
            or payload.get("governancePolicy")
            or bundle.get("governance_policy"),
            operation=f"decision_{operation}",
        )
    except (ValueError, GovernancePolicyError) as exc:
        return None, (
            jsonify(error_payload("INVALID_DATASET_GOVERNANCE_REQUEST", str(exc))),
            400,
        )
    if is_blocked(readiness):
        return readiness, (jsonify(governance_error_payload(readiness)), 422)
    return readiness, None


def governed_response(result, readiness):
    """Attach verified governance evidence without changing service payloads."""
    if readiness is not None:
        result["governance_readiness"] = readiness
    return jsonify(result), 200


def payload_with_governance_readiness(payload, readiness):
    """Pass route-verified governance evidence to backend composers only."""
    service_payload = dict(payload)
    service_payload.pop("_governance_readiness", None)
    if readiness is not None:
        service_payload["_governance_readiness"] = readiness
    return service_payload

