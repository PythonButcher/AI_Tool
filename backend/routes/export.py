# backend/routes/export.py
from flask import Blueprint, jsonify, make_response, request
import io
import pandas as pd
from backend.global_state import get_cleaned_data
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

export_bp = Blueprint('export_bp', __name__, url_prefix='/api')

@export_bp.route('/export', methods=['GET'])
def export_cleaned_data():
    cleaned_data = get_cleaned_data()
    if cleaned_data is None:
        return jsonify({"error": "No cleaned data available to export"}), 400

    try:
        if isinstance(cleaned_data, list):
            df = pd.DataFrame(cleaned_data)
        else:
            df = cleaned_data

        export_format = request.args.get('format', 'csv').lower()

        if export_format == 'csv':
            response = make_response(df.to_csv(index=False))
            response.headers['Content-Disposition'] = 'attachment; filename=cleaned_data.csv'
            response.headers['Content-Type'] = 'text/csv'

        elif export_format == 'excel':
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='CleanedData')
            output.seek(0)
            response = make_response(output.read())
            response.headers['Content-Disposition'] = 'attachment; filename=cleaned_data.xlsx'
            response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

        elif export_format == 'pdf':
            output = io.BytesIO()
            pdf = canvas.Canvas(output, pagesize=letter)
            pdf.setFont("Helvetica", 12)

            pdf.drawString(100, 750, "Cleaned Data Export")
            pdf.drawString(50, 730, "-" * 50)

            pdf.setFont("Helvetica-Bold", 16)
            pdf.drawString(50, 800, "Cleaned Data Report")
            pdf.setFont("Helvetica", 12)
            pdf.drawString(50, 780, "Generated on: " + pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'))

            pdf.setFont("Helvetica", 10)
            pdf.drawString(500, 20, f"Page 1")

            col_y = 710
            for col_name in df.columns:
                pdf.drawString(50, col_y, col_name)
                col_y -= 20

            for _, row in df.iterrows():
                row_str = ", ".join([str(val) for val in row])
                pdf.drawString(50, col_y, row_str)
                col_y -= 20
                if col_y < 50:
                    pdf.showPage()
                    pdf.setFont("Helvetica", 12)
                    col_y = 750

            pdf.save()
            response = make_response(output.getvalue())
            response.headers['Content-Disposition'] = 'attachment; filename=cleaned_data.pdf'
            response.headers['Content-Type'] = 'application/pdf'

        else:
            return jsonify({"error": "Unsupported export format"}), 400

        return response

    except Exception as e:
        return jsonify({"error": f"Error exporting data: {str(e)}"}), 500
