from flask import Blueprint, request, jsonify, make_response
import requests


def flatten_dict(d, parent_key='', sep='_'):
    """
    Recursively flattens nested dictionaries.
    Example:
    {"name": {"common": "Germany"}, "region": "Europe"}
    -> {"name_common": "Germany", "region": "Europe"}
    """
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list) and all(isinstance(i, (str, int, float)) for i in v):
            items.append((new_key, ", ".join(map(str, v))))
        elif isinstance(v, (str, int, float)):
            items.append((new_key, v))
        else:
            items.append((new_key, "Unsupported Type"))
    return dict(items)

api_fetch_bp = Blueprint('api_fetch_bp', __name__)


@api_fetch_bp.route('/api/fetch_external_data', methods=['OPTIONS'])
def handle_options():
    """
    Handles preflight CORS requests explicitly for this route.
    """
    response = make_response()
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response, 204  # 204 means "No Content" (preflight response)

@api_fetch_bp.route('/api/fetch_external_data', methods=['POST'])
def fetch_external_data():
    try:
        data = request.json
        api_url = data.get("api_url")

        if not api_url:
            print("❌ ERROR: No API URL received from frontend")
            return jsonify({"error": "API URL is required"}), 400

        print(f"🔗 Fetching data from: {api_url}")
        response = requests.get(api_url)
        response.raise_for_status()

        raw_data = response.json()
        cleaned_data = raw_data if isinstance(raw_data, list) else [raw_data]

        print(f"✅ API Response Processed: {cleaned_data[:2]}")  # Print only first 2 items to avoid overload

        return jsonify({"data_preview": cleaned_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {str(e)}")
        return jsonify({"error": f"Request error: {str(e)}"}), 500
    except Exception as e:
        print(f"❌ Server error: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500


