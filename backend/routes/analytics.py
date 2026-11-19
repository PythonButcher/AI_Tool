from flask import Blueprint, current_app, jsonify, request

from backend.analytics.change_explorer import execute_change_explorer
from backend.analytics.query import AnalyticsError, execute_query
from backend.services.metric_resolver import MetricResolutionError

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


def _run_analytics(execute):
    try:
        payload = request.get_json(silent=True)
        return jsonify(execute(payload)), 200
    except (AnalyticsError, MetricResolutionError) as exc:
        return jsonify({"error": str(exc), "code": exc.code}), 400
    except (TypeError, KeyError, ValueError) as exc:
        current_app.logger.info("Invalid analytics input: %s", exc)
        return jsonify({"error": "The query contains invalid fields or values.", "code": "invalid_query"}), 400
    except Exception:
        current_app.logger.exception("Analytics execution failed")
        return jsonify({"error": "Analytics could not execute this query. Your saved work is unchanged.", "code": "execution_failed"}), 500


@analytics_bp.post("/query")
def query_analytics():
    return _run_analytics(execute_query)


@analytics_bp.post("/change-explorer")
def change_explorer():
    return _run_analytics(execute_change_explorer)
