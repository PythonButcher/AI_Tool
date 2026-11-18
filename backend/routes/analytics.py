from flask import Blueprint, current_app, jsonify, request

from backend.analytics.query import AnalyticsError, execute_query
from backend.services.metric_resolver import MetricResolutionError

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


@analytics_bp.post("/query")
def query_analytics():
    try:
        payload = request.get_json(silent=True)
        return jsonify(execute_query(payload)), 200
    except (AnalyticsError, MetricResolutionError) as exc:
        return jsonify({"error": str(exc), "code": exc.code}), 400
    except (TypeError, KeyError, ValueError) as exc:
        current_app.logger.info("Invalid analytics input: %s", exc)
        return jsonify({"error": "The query contains invalid fields or values.", "code": "invalid_query"}), 400
    except Exception:
        current_app.logger.exception("Analytics execution failed")
        return jsonify({"error": "Analytics could not execute this query. Your saved work is unchanged.", "code": "execution_failed"}), 500
