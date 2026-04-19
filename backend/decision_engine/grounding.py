"""Grounding summaries for the Phase 4 decision chat engine."""

from __future__ import annotations

from typing import Any, Dict, List


def _sample_names(items: List[Dict[str, Any]], key: str) -> List[str]:
    names = []
    for item in items[:5]:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or item.get("name") or item.get(key) or "").strip()
        if label:
            names.append(label)
    return names


def build_grounding_summary(dataset: List[Dict[str, Any]], semantic_model: Dict[str, Any] | None) -> Dict[str, Any]:
    """Return a compact grounding summary that the frontend can display directly."""
    semantic_model = semantic_model if isinstance(semantic_model, dict) else {}
    metrics = semantic_model.get("metrics") if isinstance(semantic_model.get("metrics"), list) else []
    dimensions = semantic_model.get("dimensions") if isinstance(semantic_model.get("dimensions"), list) else []
    sample_columns = list(dataset[0].keys())[:8] if dataset else []

    return {
        "dataset": {
            "row_count": len(dataset),
            "column_count": len(dataset[0]) if dataset else 0,
            "sample_columns": sample_columns,
        },
        "semantic_model": {
            "metric_count": len(metrics),
            "dimension_count": len(dimensions),
            "sample_metrics": _sample_names(metrics, "id"),
            "sample_dimensions": _sample_names(dimensions, "id"),
        },
    }
