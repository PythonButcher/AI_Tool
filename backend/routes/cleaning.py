from flask import Blueprint, jsonify, request
from backend.global_state import get_uploaded_df, set_cleaned_data

cleaning_bp = Blueprint('cleaning_bp', __name__, url_prefix='/api')

@cleaning_bp.route('/cleaning', methods=['POST'])
def get_clean():
    uploaded_df = get_uploaded_df()
    if uploaded_df is None:
        return jsonify({"error": "No file has been uploaded yet"}), 400

    try:
        data = request.json
        task = data.get('task', '')

        if task == "remove_nulls":
            cleaned_df = uploaded_df.dropna()
        elif task == "fill_nulls":
            fill_value = data.get('fill_value', '')
            cleaned_df = uploaded_df.fillna(fill_value)
        elif task == "standardize":
            cleaned_df = uploaded_df.applymap(lambda x: x.lower() if isinstance(x, str) else x)
        else:
            return jsonify({"error": "Invalid cleaning task"}), 400

        # Save cleaned data to global state
        set_cleaned_data(cleaned_df)

        # Prepare cleaned_preview and cleaned_data
        cleaned_preview = cleaned_df.head(10).to_dict(orient='records')
        cleaned_data = cleaned_df.to_dict(orient='records')

        return jsonify({
            "message": "Cleaning task completed successfully",
            "cleaned_preview": cleaned_preview,
            "cleaned_data": cleaned_data
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to clean data: {str(e)}"}), 500

@cleaning_bp.route('/bypass_cleaning', methods=['POST'])
def bypass_cleaning():
    uploaded_df = get_uploaded_df()
    if uploaded_df is None:
        return jsonify({"error": "No file has been uploaded yet"}), 400

    try:
        # Directly set cleaned_df to the uploaded_df
        cleaned_df = uploaded_df
        set_cleaned_data(cleaned_df)

        # Prepare cleaned_preview and cleaned_data
        cleaned_preview = cleaned_df.head(10).to_dict(orient='records')
        cleaned_data = cleaned_df.to_dict(orient='records')

        return jsonify({
            "message": "Bypassed cleaning. Data is considered cleaned as is.",
            "cleaned_preview": cleaned_preview,
            "cleaned_data": cleaned_data
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to bypass cleaning: {str(e)}"}), 500
