from copy import deepcopy
from unittest.mock import patch

import pandas as pd
import pytest
from flask import Flask

from backend.analytics.query import AnalyticsError, execute_query
from backend.routes.analytics import analytics_bp


ROWS = [
    {"date": "2026-01-01", "region": "East", "product": "A", "sales": 0, "cost": 0},
    {"date": "2026-01-02T12:00:00Z", "region": "East", "product": "A", "sales": 10, "cost": 5},
    {"date": "2026-01-02T23:59:59.999Z", "region": "West", "product": "A", "sales": 20, "cost": 8},
    {"date": "2026-01-03", "region": "West", "product": "B", "sales": 30, "cost": 10},
]
MEASURE = {"id": "revenue", "field": "sales", "aggregation": "sum"}


def run(query=None, **overrides):
    return execute_query({"source": {"kind": "inline", "id": "orders", "name": "Orders"}, "dataset": ROWS,
                          "query": {"measures": [MEASURE], **(query or {})}, **overrides})


@pytest.mark.parametrize("aggregation,expected", [("sum", 60), ("avg", 15), ("min", 0), ("max", 30),
                                                   ("count", 4), ("count_distinct", 4), ("count_rows", 4),
                                                   ("median", 15), ("percentile", 22.5)])
def test_aggregations(aggregation, expected):
    assert run({"measures": [{**MEASURE, "aggregation": aggregation, "percentile": .75}]})["summary"]["revenue"] == expected


def test_multi_measure_formula_and_top_n_do_not_change_totals():
    result = run({"measures": [MEASURE, {"id": "cost", "field": "cost"},
                                {"id": "margin", "formula": "(revenue - cost) / revenue"}],
                  "group_by": [{"field": "region"}], "sort": {"field": "revenue", "direction": "desc"}, "limit": 1})
    assert result["rows"] == [{"region": "West", "revenue": 50, "cost": 18, "margin": .64}]
    assert result["summary"]["revenue"] == 60
    assert result["truncated"] and result["total_result_rows"] == 2


def test_and_or_filters_intersect_without_losing_numeric_zero():
    result = run({"filters": {"op": "or", "rules": [{"field": "sales", "operator": "eq", "value": 0},
                                                        {"op": "and", "rules": [{"field": "region", "value": "West"},
                                                                                   {"field": "sales", "operator": "gt", "value": 20}]}]}})
    assert result["row_count"] == 2
    assert result["summary"]["revenue"] == 30


@pytest.mark.parametrize("grain,count", [("day", 3), ("week", 1), ("month", 1), ("quarter", 1), ("year", 1)])
def test_calendar_grains(grain, count):
    result = run({"group_by": [{"field": "date", "grain": grain}]})
    assert len(result["rows"]) == count
    assert sum(r["revenue"] for r in result["rows"]) == 60


def test_date_end_includes_fractional_seconds_and_zero_comparison_is_unavailable():
    result = run({"period": {"field": "date", "start": "2026-01-02", "end": "2026-01-02"},
                  "comparison": {"kind": "previous_period"}})
    assert result["summary"]["revenue"] == 30
    assert result["row_count"] == 2
    assert result["comparison"]["summary"]["revenue"] == 0
    assert result["comparison"]["deltas"]["revenue"] == {"absolute": 30, "percent": None}


def test_pivot_totals_reaggregate_means_instead_of_summing_cell_averages():
    result = run({"mode": "pivot", "measures": [{**MEASURE, "aggregation": "avg"}],
                  "group_by": [{"field": "region"}, {"field": "product"}]})
    assert result["pivot"]["grand_totals"]["revenue"] == 15
    assert result["pivot"]["row_totals"] == [{"region": "East", "revenue": 5}, {"region": "West", "revenue": 25}]


@pytest.mark.parametrize("post,expected", [("running_total", [10, 60]), ("percent_total", [100/6, 500/6]),
                                          ("rank", [2, 1]), ("moving_average", [10, 30])])
def test_post_calculations_before_result_limiting(post, expected):
    result = run({"measures": [{**MEASURE, "post": post}], "group_by": [{"field": "region"}]})
    assert [r["revenue"] for r in result["rows"]] == pytest.approx(expected)


def test_detail_paging_and_histogram_count_parity():
    detail = run({"mode": "rows", "columns": ["region", "sales"], "offset": 1, "limit": 2})
    assert detail["rows"] == [{"region": "East", "sales": 10}, {"region": "West", "sales": 20}]
    histogram = run({"mode": "histogram", "field": "sales", "bins": 2})
    assert sum(row["count"] for row in histogram["rows"]) == 4


def test_empty_selection_and_non_numeric_values_have_distinct_results():
    assert run({"filters": [{"field": "region", "value": "Missing"}]})["rows"] == []
    with pytest.raises(AnalyticsError, match="nonnumeric"):
        run({"measures": [{**MEASURE, "field": "region"}]})


@pytest.mark.parametrize("expression", ["__import__('os')", "revenue.__class__", "revenue ** 1000", "unknown + 1"])
def test_calculations_reject_executable_or_unknown_expressions(expression):
    with pytest.raises(AnalyticsError):
        run({"measures": [MEASURE, {"id": "danger", "formula": expression}]})


def test_fingerprint_detects_changed_source_and_metadata_returns_no_rows():
    metadata = run(metadata_only=True)
    assert "rows" not in metadata
    assert run(expected_fingerprint=metadata["dataset"]["fingerprint"])["summary"]["revenue"] == 60
    rows = deepcopy(ROWS)
    rows[0]["sales"] = 1
    with pytest.raises(AnalyticsError, match="changed"):
        run(dataset=rows, expected_fingerprint=metadata["dataset"]["fingerprint"])


def test_missing_explicit_source_never_queries_active_data():
    with patch("backend.services.dataset_context.resolve_active_dataframe") as active:
        with pytest.raises(AnalyticsError):
            run(source={"kind": "inline", "id": "lost"}, dataset=None)
    active.assert_not_called()


def test_workspace_execution_keeps_governed_identity_and_lineage():
    bundle = {"dataframe": pd.DataFrame(ROWS), "semantic_model": {}, "dataset_ref": {"source": "workspace", "dataset_id": "ws"},
              "analysis_lineage": {"relationship_ids": ["rel"]}}
    context = {"workspace_id": "ws", "workspace_version": 3}
    with patch("backend.analytics.query.resolve_analysis_dataset_bundle", return_value=bundle) as resolve:
        result = run(source={"kind": "workspace", "analysis_context": context}, dataset=None)
    resolve.assert_called_once_with(context)
    assert result["analysis_lineage"]["relationship_ids"] == ["rel"]
    assert result["dataset"]["dataset_id"] == "ws"


def test_governed_metric_filters_are_not_bypassed_by_raw_measure_ui():
    model = {"dimensions": [], "metrics": [{"id": "east_sales", "field": "sales", "default_aggregation": "sum",
                                             "filters": [{"field": "region", "value": "East"}]}]}
    result = run({"measures": [{"id": "governed", "metric_id": "east_sales"}]}, semantic_model=model)
    assert result["summary"]["governed"] == 10


def test_route_contract_and_safe_errors():
    app = Flask(__name__)
    app.register_blueprint(analytics_bp)
    client = app.test_client()
    assert client.post("/api/analytics/query", json=[]).status_code == 400
    response = client.post("/api/analytics/query", json={"source": {"kind": "inline", "id": "orders"}, "dataset": ROWS,
                                                       "query": {"measures": [MEASURE]}})
    assert response.status_code == 200
    assert response.json["summary"] == {"revenue": 60}


def test_segment_comparison_uses_independent_filters_and_same_period():
    result = run({"filters": [{"field": "region", "value": "East"}],
                  "comparison": {"kind": "segment", "filters": [{"field": "region", "value": "West"}]}})
    assert result["summary"]["revenue"] == 10
    assert result["comparison"]["summary"]["revenue"] == 50
    assert result["comparison"]["deltas"]["revenue"] == {"absolute": -40, "percent": -80}


def test_percentage_stack_and_aligned_period_comparison():
    result = run({"measures": [MEASURE, {"id": "cost", "field": "cost"}], "group_by": [{"field": "region"}], "normalize_stack": True})
    assert sum(result["rows"][0][key] for key in ("revenue", "cost")) == pytest.approx(100)
    assert result["summary"]["revenue"] == 60
    result = run({"group_by": [{"field": "date", "grain": "day"}],
                  "period": {"field": "date", "start": "2026-01-02", "end": "2026-01-03"},
                  "comparison": {"kind": "previous_period"}})
    assert [row["revenue"] for row in result["comparison"]["aligned_rows"]] == [None, 0]


def test_datahub_governance_cannot_be_bypassed():
    bundle = {"dataframe": pd.DataFrame(ROWS), "governance_policy": {"required_fields": ["missing"]}}
    with patch("backend.analytics.query.resolve_dataset_bundle", return_value=bundle):
        with pytest.raises(AnalyticsError, match="governance"):
            run(source={"kind": "datahub", "id": "orders"})
