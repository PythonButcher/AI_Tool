from flask import Blueprint, jsonify, request
from backend.utils.global_state import (
    get_cleaned_data,
    get_uploaded_df,
    set_cleaned_data,
)
from backend.services.manual_cleaning_engine import apply_steps

manual_cleaning_bp = Blueprint('manual_cleaning_bp', __name__, url_prefix='/api')


@manual_cleaning_bp.route('/manual_cleaning', methods=['POST'])
def manual_cleaning():
    cleaned = get_cleaned_data()
    base_df = cleaned if cleaned is not None else get_uploaded_df()
    if base_df is None:
        return jsonify({"error": "No dataset available. Upload data first."}), 400

    payload = request.get_json(force=True, silent=True) or {}
    steps = payload.get('steps', [])
    preview_only = payload.get('preview_only', False)

    try:
        cleaned_df = apply_steps(steps, base_df)
    except Exception as exc:
        return jsonify({"error": f"Failed to apply cleaning steps: {exc}"}), 500

    if cleaned_df.empty and not base_df.empty and not preview_only:
        return jsonify({
            "error": "Cleaning steps produced an empty dataset. No changes were applied. Run Preview to inspect the result before Apply All.",
            "row_count": 0,
        }), 400
    preview_rows = cleaned_df.head(100).to_dict(orient='records')
    full_rows = cleaned_df.to_dict(orient='records')

    if not preview_only:
        set_cleaned_data(cleaned_df)

    return jsonify({
        "message": "Cleaning steps applied successfully",
        "preview": preview_rows,
        "cleaned_data": full_rows,
        "row_count": len(cleaned_df),
        "steps_applied": len(steps),
        "committed": not preview_only,
    })


