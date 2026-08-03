"""Focused regressions for trustworthy natural-language chart construction."""

import unittest

from backend.nlp_engine.chart_builder import ChartBuildError, build_chart_response
from backend.nlp_engine.nlp_extraction import _safe_float, analyse_columns
from backend.nlp_engine.nlp_interpreter import interpret_nl_query
from backend.services.metric_resolver import MetricResolutionError, MetricResolver


class NlpChartReliabilityTests(unittest.TestCase):
    """Prove identifiers, qualified fields, and unusable measures stay safe."""

    def setUp(self):
        # The qualified names intentionally resemble real workspace aliases.
        # Source-namespace tokens may help disambiguate a business field, but
        # they must never make every column in that source equally relevant.
        self.dataset = [
            {
                "sales_transactions_5000_csv.TransactionID": "TXN-000001",
                "sales_transactions_5000_csv.ProductID": "PROD-001",
                "sales_transactions_5000_csv.Quantity": 2,
                "sales_transactions_5000_csv.UnitPrice": 60.0,
                "sales_transactions_5000_csv.TotalAmount": 120.0,
                "hardware_inventory_5000_csv.Category": "Hardware",
            },
            {
                "sales_transactions_5000_csv.TransactionID": "TXN-000002",
                "sales_transactions_5000_csv.ProductID": "PROD-002",
                "sales_transactions_5000_csv.Quantity": 1,
                "sales_transactions_5000_csv.UnitPrice": 80.0,
                "sales_transactions_5000_csv.TotalAmount": 80.0,
                "hardware_inventory_5000_csv.Category": "Office",
            },
        ]

    def test_safe_float_requires_the_complete_value_to_be_numeric(self):
        """Embedded digits in identifiers must not turn text columns into measures."""
        self.assertIsNone(_safe_float("TXN-000001"))
        self.assertIsNone(_safe_float("PROD-002"))
        self.assertEqual(_safe_float("$1,234.50"), 1234.5)
        self.assertEqual(_safe_float("(42.5)"), -42.5)

    def test_plain_language_query_resolves_business_fields_not_namespace_tokens(self):
        """Revenue and category semantics must outrank shared source aliases."""
        columns = analyse_columns(self.dataset)

        interpretation = interpret_nl_query(
            "Which inventory categories generated the most total sales revenue? "
            "Show total revenue by category as a bar chart.",
            columns,
        )

        self.assertEqual(
            interpretation["fields"]["value"],
            "sales_transactions_5000_csv.TotalAmount",
        )
        self.assertEqual(
            interpretation["fields"]["category"],
            "hardware_inventory_5000_csv.Category",
        )
        self.assertEqual(interpretation["filters"], [])

    def test_chart_builder_rejects_a_measure_without_numeric_values(self):
        """A selected text measure must produce a grounded error, not an empty chart."""
        interpretation = {
            "chart_type": "Bar",
            "fields": {
                "value": "sales_transactions_5000_csv.TransactionID",
                "category": "hardware_inventory_5000_csv.Category",
                "time": None,
                "secondary_value": None,
            },
        }

        with self.assertRaises(ChartBuildError) as error:
            build_chart_response(self.dataset, interpretation)

        self.assertEqual(error.exception.code, "chart_measure_not_numeric")
        self.assertIn("usable numeric values", str(error.exception))

    def test_semantic_metric_rejects_a_measure_without_numeric_values(self):
        """Semantic aggregation must enforce the same numeric evidence boundary."""
        with self.assertRaises(MetricResolutionError) as error:
            MetricResolver.resolve(
                metric={
                    "id": "metric_transaction_id_sum",
                    "name": "Transaction ID",
                    "label": "Transaction ID",
                    "field": "TransactionID",
                    "default_aggregation": "sum",
                    "expression": {
                        "type": "column_aggregation",
                        "column": "TransactionID",
                        "aggregation": "sum",
                    },
                },
                dataset=[
                    {"TransactionID": "TXN-000001", "Category": "Hardware"},
                    {"TransactionID": "TXN-000002", "Category": "Office"},
                ],
                semantic_model={
                    "metrics": [],
                    "dimensions": [
                        {
                            "id": "dimension_category",
                            "field": "Category",
                            "name": "Category",
                            "label": "Category",
                        }
                    ],
                },
                group_by=["Category"],
            )

        self.assertEqual(error.exception.code, "metric_measure_not_numeric")
        self.assertIn("usable numeric values", str(error.exception))


if __name__ == "__main__":
    unittest.main()
