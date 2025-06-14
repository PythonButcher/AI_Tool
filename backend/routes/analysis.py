# backend/routes/analysis.py
from flask import Blueprint, jsonify, request
import io
from backend.global_state import get_uploaded_df

analysis_bp = Blueprint('analysis_bp', __name__, url_prefix='/api')

@analysis_bp.route('/numbers', methods=['GET'])
def numbers_endpoint():
    uploaded_df = get_uploaded_df()
    if uploaded_df is None:
        return jsonify({"error": "No file has been uploaded yet"}), 400

    try:
        buffer = io.StringIO()
        uploaded_df.info(buf=buffer)
        info_output = buffer.getvalue()

        numeric_summary = uploaded_df.select_dtypes(include='number').sum().to_dict()
        categorical_summary = uploaded_df.select_dtypes(exclude='number').apply(lambda x: x.value_counts().to_dict()).to_dict()

        return jsonify({
            "data_info": info_output,
            "numeric_summary": numeric_summary,
            "categorical_summary": categorical_summary
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to retrieve data information: {str(e)}"}), 500


@analysis_bp.route('/filtered-upload', methods=['POST'])
def receive_filtered_data():
    try:
        json_data = request.get_json()
        if not json_data or 'data_preview' not in json_data:
            return jsonify({"error": "Missing 'data_preview' key"}), 400

        from backend.global_state import set_uploaded_df
        import pandas as pd

        df = pd.DataFrame(json_data['data_preview'])
        set_uploaded_df(df)

        return jsonify({"message": "Filtered data received and stored"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to store filtered data: {str(e)}"}), 500


@analysis_bp.route('/catstats', methods=['GET'])
def cat_col():
    uploaded_df = get_uploaded_df()
    if uploaded_df is None:
        return jsonify({"error": "No file has been uploaded yet."}), 400

    try:
        column_name = request.args.get('columnName')
        if not column_name:
            return jsonify({"error": "No 'columnName' parameter provided."}), 400

        if column_name not in uploaded_df.columns:
            return jsonify({"error": f"Column '{column_name}' does not exist in the dataframe."}), 400

        if uploaded_df[column_name].dtype != 'object':
            return jsonify({"error": f"Column '{column_name}' is not categorical."}), 400

        category_counts = uploaded_df[column_name].value_counts(dropna=False)
        category_mode = uploaded_df[column_name].mode(dropna=False).tolist()

        return jsonify({
            "counts": category_counts.to_dict(),
            "mode": category_mode
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error calculating categorical statistics: {str(e)}"}), 500


@analysis_bp.route('/categorical-columns', methods=['GET'])
def get_categorical_columns():
    uploaded_df = get_uploaded_df()
    if uploaded_df is None:
        return jsonify({"error": "No file has been uploaded yet."}), 400

    try:
        categorical_columns = uploaded_df.select_dtypes(include=['object']).columns.tolist()
        return jsonify(categorical_columns), 200

    except Exception as e:
        return jsonify({"error": f"Error retrieving categorical columns: {str(e)}"}), 500


@analysis_bp.route('/stats', methods=['GET'])
def get_stats():
    uploaded_df = get_uploaded_df()
    if uploaded_df is None:
        return jsonify({"error": "No file has been uploaded yet"}), 400

    try:
        numeric_df = uploaded_df.select_dtypes(include=['number'])
        if numeric_df.empty:
            return jsonify({"error": "No numeric columns available for statistics calculation."}), 400

        mean = numeric_df.mean().to_dict()
        median = numeric_df.median().to_dict()
        mode = numeric_df.mode().iloc[0].to_dict()

        return jsonify({
            'mean': mean,
            'median': median,
            'mode': mode
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error calculating statistics: {str(e)}"}), 500
