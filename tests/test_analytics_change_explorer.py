from datetime import datetime, timezone
from unittest.mock import patch

import pandas as pd
import pytest
from flask import Flask

from backend.analytics.change_explorer import execute_change_explorer
from backend.analytics.query import AnalyticsError, execute_query
from backend.routes.analytics import analytics_bp


BASELINE = {"start": "2026-01-01", "end": "2026-01-02"}
CURRENT = {"start": "2026-02-01", "end": "2026-02-02"}
SOURCE = {"kind": "inline", "id": "orders", "name": "Orders"}
SUM_METRIC = {"aggregation": "sum", "field": "sales"}
COUNT_METRIC = {"aggregation": "count_rows"}
NUMERIC_FIELDS = ("baseline_value", "current_value", "delta", "baseline_count", "current_count", "volume_effect", "rate_effect")


def order(date, region, sales=None, status="open"):
    return {"date": date, "region": region, "sales": sales, "status": status}


def payload(rows, **overrides):
    return {"source": SOURCE, "dataset": rows, "semantic_model": {}, "date_field": "date", "segment_field": "region",
            "baseline": BASELINE, "current": CURRENT, "metric": SUM_METRIC, **overrides}


def numbers(baseline_value, current_value, delta, baseline_count, current_count, volume, rate):
    return dict(zip(NUMERIC_FIELDS, (baseline_value, current_value, delta, baseline_count, current_count, volume, rate)))


def assert_reconciles(result):
    totals, drivers = result["totals"], result["drivers"]
    for row in [totals, *drivers]:
        assert row["current_value"] - row["baseline_value"] == pytest.approx(row["delta"])
        assert row["volume_effect"] + row["rate_effect"] == pytest.approx(row["delta"])
    for key in NUMERIC_FIELDS:
        assert sum(row[key] for row in drivers) == pytest.approx(totals[key])


@pytest.fixture
def client():
    app = Flask(__name__)
    app.register_blueprint(analytics_bp)
    return app.test_client()


@pytest.fixture
def offsetting_orders():
    return [order(BASELINE["start"], "B", 40), order(CURRENT["start"], "B", 0),
            *[order(BASELINE["start"], "A", 10) for _ in range(2)],
            *[order(CURRENT["start"], "A", 20) for _ in range(3)]]


def test_endpoint_preserves_source_identity_and_explains_offsetting_changes(client, offsetting_orders):
    request = payload(offsetting_orders, source={**SOURCE, "row_scope": "preview"})
    metadata = execute_query({**request, "metadata_only": True})
    response = client.post("/api/analytics/change-explorer", json={
        **request, "expected_fingerprint": metadata["dataset"]["fingerprint"],
    })
    assert response.status_code == 200
    result = response.json
    assert result["schema_version"] == 1
    assert result["dataset"] == metadata["dataset"]
    assert result["dataset"]["source_row_count"] == 7
    assert result["dataset"]["scope"] == "preview"
    assert result["analysis_lineage"] is None
    assert datetime.fromisoformat(result["executed_at"]).tzinfo == timezone.utc
    assert result["baseline"] == BASELINE and result["current"] == CURRENT
    assert (result["date_field"], result["segment_field"], result["metric"]) == ("date", "region", SUM_METRIC)
    assert result["segment_count"] == 2
    assert result["totals"] == numbers(60, 60, 0, 3, 4, 15, -15)
    assert result["drivers"] == [
        {"kind": "segment", "segment": "A", **numbers(20, 60, 40, 2, 3, 15, 25)},
        {"kind": "segment", "segment": "B", **numbers(40, 0, -40, 1, 1, 0, -40)},
    ]
    assert_reconciles(result)


def test_rank_is_deterministic_and_other_adds_omitted_segment_effects(offsetting_orders):
    rows = offsetting_orders + [order(BASELINE["start"], "Exit", 4), order(CURRENT["start"], "New", 6)]
    result = execute_change_explorer(payload(rows, limit=1))
    assert result["segment_count"] == 4
    assert result["drivers"] == [
        {"kind": "segment", "segment": "A", **numbers(20, 60, 40, 2, 3, 15, 25)},
        {"kind": "other", "segment": None, **numbers(44, 6, -38, 2, 2, 2, -40)},
    ]
    assert execute_change_explorer(payload(list(reversed(rows)), limit=1))["drivers"] == result["drivers"]
    assert_reconciles(result)


def test_entrants_exits_null_observations_and_missing_labels():
    rows = [order(BASELINE["start"], "Exit", 5), order(CURRENT["start"], "Exit"),
            order(CURRENT["start"], "New", 9), order(BASELINE["start"], "New"),
            order(BASELINE["start"], None, 2), order(CURRENT["start"], None, 4),
            order(CURRENT["start"], "No observations")]
    result = execute_change_explorer(payload(rows))
    assert result["drivers"] == [
        {"kind": "segment", "segment": "New", **numbers(0, 9, 9, 0, 1, 9, 0)},
        {"kind": "segment", "segment": "Exit", **numbers(5, 0, -5, 1, 0, -5, 0)},
        {"kind": "missing", "segment": None, **numbers(2, 4, 2, 1, 1, 0, 2)},
        {"kind": "segment", "segment": "No observations", **numbers(0, 0, 0, 0, 0, 0, 0)},
    ]
    assert result["totals"] == numbers(7, 13, 6, 2, 2, 4, 2)
    assert_reconciles(result)


def test_count_rows_applies_identical_filters_and_inclusive_utc_days():
    rows = [
        order("2026-01-01T00:00:00Z", "East"), order("2026-01-02T23:59:59.999999999Z", "East"),
        order("2026-01-03T00:00:00Z", "East"), order("2026-02-01T00:00:00+01:00", "East"),
        order("2026-01-31T23:00:00-01:00", "East", "ignored"), order("2026-02-02T23:59:59.999Z", "West"),
        order("2026-02-03T00:00:00Z", "East"), order(None, "East"),
        order("2026-01-01", "East", status="closed"), order("2026-02-02", "East", status="closed"),
    ]
    result = execute_change_explorer(payload(rows, metric=COUNT_METRIC, filters=[{"field": "status", "value": "open"}]))
    assert result["totals"] == numbers(2, 2, 0, 2, 2, 0, 0)
    assert result["drivers"] == [
        {"kind": "segment", "segment": "East", **numbers(2, 1, -1, 2, 1, -1, 0)},
        {"kind": "segment", "segment": "West", **numbers(0, 1, 1, 0, 1, 1, 0)},
    ]
    assert result["metric"] == COUNT_METRIC
    assert result["dataset"]["scope"] == "unknown"
    assert_reconciles(result)


def test_typed_segment_labels_remain_distinct():
    rows = [order(BASELINE["start"], label) for label in (True, 1, "1", "", "Missing", None)]
    result = execute_change_explorer(payload(rows, metric=COUNT_METRIC))
    assert result["segment_count"] == 6
    assert [(type(row["segment"]), row["segment"]) for row in result["drivers"]] == [
        (str, ""), (int, 1), (str, "1"), (str, "Missing"), (bool, True), (type(None), None),
    ]
    assert_reconciles(result)

    for label in (True, 1, "1", None):
        drilled = execute_query({
            **payload(rows),
            "query": {"mode": "aggregate", "measures": [{"id": "records", **COUNT_METRIC}],
                      "filters": [{"field": "region", "operator": "eq", "type": "segment", "value": label}]},
        })
        assert drilled["summary"] == {"records": 1}


def test_empty_populations_return_zero_totals():
    rows = [order(None, "East", 1), order("2026-01-30", "East", "outside")]
    result = execute_change_explorer(payload(rows))
    assert result["totals"] == numbers(0, 0, 0, 0, 0, 0, 0)
    assert result["segment_count"] == 0 and result["drivers"] == []
    for rows in ([order(None, "East")], [order(CURRENT["start"], "East")]):
        result = execute_change_explorer(payload(rows, filters=[{"field": "region", "value": "West"}]))
        assert result["totals"] == numbers(0, 0, 0, 0, 0, 0, 0)


def test_sums_preserve_large_integers_and_float_cancellation():
    integer_rows = [order(BASELINE["start"], "East", 2**62) for _ in range(2)] + [
        order(CURRENT["start"], "East", 2**62), order(CURRENT["start"], "East", 2**62 + 1),
    ]
    result = execute_change_explorer(payload(integer_rows))
    assert result["totals"] == numbers(2**63, 2**63 + 1, 1, 2, 2, 0, 1)
    float_rows = [order(BASELINE["start"], "East", value) for value in (1e16, 0.5, -1e16)] + [
        order(CURRENT["start"], "East", "1.5"),
    ]
    result = execute_change_explorer(payload(float_rows))
    assert result["totals"] == pytest.approx(numbers(0.5, 1.5, 1, 3, 1, -5/3, 8/3))
    assert_reconciles(result)


@pytest.mark.parametrize(("override", "code", "message"), [
    ({"baseline": None}, "invalid_dates", "baseline"),
    ({"baseline": {"start": "2026-01-01T00:00:00Z", "end": "2026-01-02"}}, "invalid_dates", "YYYY-MM-DD"),
    ({"baseline": {"start": "2026-01-3", "end": "2026-01-04"}}, "invalid_dates", "YYYY-MM-DD"),
    ({"current": {"start": "2026-02-28", "end": "2026-02-30"}}, "invalid_dates", "YYYY-MM-DD"),
    ({"current": {"start": "2026-02-03", "end": "2026-02-02"}}, "invalid_dates", "on or before"),
    ({"current": {"start": "2026-01-02", "end": "2026-02-02"}}, "invalid_dates", "must end before"),
    ({"current": {"start": "2025-01-01", "end": "2025-01-02"}}, "invalid_dates", "must end before"),
    ({"segment_field": "missing"}, "missing_field", "missing"),
    ({"metric": {"aggregation": "avg"}}, "invalid_query", "count_rows or sum"),
    ({"metric": {"aggregation": "sum"}}, "missing_field", "unavailable"),
    ({"limit": True}, "invalid_query", "integer from 1 to 30"),
    ({"limit": 0}, "invalid_query", "integer from 1 to 30"),
    ({"limit": 31}, "invalid_query", "integer from 1 to 30"),
    ({"filters": {"field": "missing", "value": "East"}}, "missing_field", "missing"),
    ({"source": None}, "dataset_required", "Choose a dataset"),
    ({"expected_fingerprint": "stale"}, "dataset_changed", "changed"),
    ({"dataset": [order("invalid", "East", 1)]}, "invalid_dates", "invalid dates"),
])
def test_invalid_requests_return_actionable_400s(client, override, code, message):
    response = client.post("/api/analytics/change-explorer", json=payload([order(BASELINE["start"], "East", 3)], **override))
    assert response.status_code == 400
    assert response.json["code"] == code
    assert message in response.json["error"]


@pytest.mark.parametrize("value", ["invalid", "NaN", "1e400", float("inf"), True])
def test_invalid_numeric_values_are_rejected(client, value):
    response = client.post("/api/analytics/change-explorer", json=payload([order(CURRENT["start"], "East", value)]))
    assert response.status_code == 400
    assert response.json["code"] == "invalid_measure"
    assert "'sales'" in response.json["error"]


def test_comparison_must_serialize_finite_numbers(client):
    rows = [order(CURRENT["start"], "East", 1e308) for _ in range(2)]
    response = client.post("/api/analytics/change-explorer", json=payload(rows))
    assert response.status_code == 400
    assert response.json["code"] == "invalid_measure"
    assert "numeric range" in response.json["error"]


def test_caps_segments_across_both_periods_and_rows_before_analysis():
    rows = [order(BASELINE["start"] if index % 2 else CURRENT["start"], index) for index in range(20_001)]
    with pytest.raises(AnalyticsError, match="Too many segments") as exc:
        execute_change_explorer(payload(rows, metric=COUNT_METRIC))
    assert exc.value.code == "result_too_large"
    capped = execute_change_explorer(payload(rows[:-1], metric=COUNT_METRIC))
    assert capped["segment_count"] == 20_000
    assert len(capped["drivers"]) == 13 and capped["drivers"][-1]["kind"] == "other"
    assert_reconciles(capped)
    with pytest.raises(AnalyticsError, match="100,000 rows"):
        execute_change_explorer(payload([rows[0]] * 100_001))
    bundle = {"dataframe": pd.DataFrame(index=pd.RangeIndex(1_000_001))}
    with patch("backend.analytics.query.resolve_analysis_dataset_bundle", return_value=bundle):
        with pytest.raises(AnalyticsError, match="one-million-row") as exc:
            execute_change_explorer(payload(None, source={"kind": "workspace", "analysis_context": {}}))
    assert exc.value.code == "source_too_large"


def test_workspace_source_is_resolved_once_and_keeps_lineage(offsetting_orders):
    context = {"workspace_id": "ws", "workspace_version": 3}
    bundle = {"dataframe": pd.DataFrame(offsetting_orders, index=[0] * len(offsetting_orders)),
              "dataset_ref": {"source": "workspace", "dataset_id": "ws", "path": "internal"},
              "analysis_lineage": {"relationship_ids": ["rel"]}}
    with patch("backend.analytics.query.resolve_analysis_dataset_bundle", return_value=bundle) as resolve:
        result = execute_change_explorer(payload(None, source={"kind": "workspace", "analysis_context": context}))
    resolve.assert_called_once_with(context)
    assert result["analysis_lineage"] == bundle["analysis_lineage"]
    assert result["dataset"]["source"] == "workspace"
    assert result["dataset"]["dataset_id"] == "ws"
    assert result["dataset"]["scope"] == "full"
    assert "path" not in result["dataset"]
    assert result["totals"] == numbers(60, 60, 0, 3, 4, 15, -15)


def test_datahub_governance_is_enforced(client, offsetting_orders):
    bundle = {"dataframe": pd.DataFrame(offsetting_orders), "governance_policy": {"required_fields": ["missing"]}}
    with patch("backend.analytics.query.resolve_dataset_bundle", return_value=bundle) as resolve:
        response = client.post("/api/analytics/change-explorer", json=payload(None, source={"kind": "datahub", "id": "orders"}))
    resolve.assert_called_once_with(dataset_ref={"source": "datahub", "dataset_id": "orders"}, allow_active_fallback=False)
    assert response.status_code == 400 and response.json["code"] == "governance_blocked"


def test_endpoint_rejects_malformed_json_and_uses_safe_unexpected_error(client):
    malformed = client.post("/api/analytics/change-explorer", data="{", content_type="application/json")
    assert malformed.status_code == 400
    assert malformed.json == {"error": "Request must be an object.", "code": "invalid_query"}
    with patch("backend.routes.analytics.execute_change_explorer", side_effect=RuntimeError("private details")):
        response = client.post("/api/analytics/change-explorer", json={})
    assert response.status_code == 500
    assert response.json == {"error": "Analytics could not execute this query. Your saved work is unchanged.",
                             "code": "execution_failed"}
