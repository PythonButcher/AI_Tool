import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import Flask, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge
from flask_cors import CORS
from backend.routes.upload import upload_bp
from backend.routes.api_fetch import api_fetch_bp
from backend.routes.analysis import analysis_bp
from backend.routes.cleaning import cleaning_bp
from backend.routes.export import export_bp
from backend.routes.sql_fetch import sql_fetch_bp
from backend.services.ai_storyboard_gemini import ai_storyboard_gemini
from backend.services.ai_storyboard_openai import ai_storyboard_openai
from backend.services.ai_logic import ai_bp
from backend.services.ai_logic_gemini import ai_gemini_bp
from backend.services.nlp_routes import nlp_bp
from backend.routes.raw_data import raw_data_bp
from backend.services.autopilot_routes import autopilot_bp

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def create_app():
    app = Flask(__name__)

    # ✅ Limit uploads to 100 MB (adjust as needed)
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  

    # Apply CORS to API routes and ensure preflight headers are present
    app.config["CORS_HEADERS"] = "Content-Type, Authorization"
    CORS(
        app,
        resources={r"/api/*": {"origins": "http://localhost:3000"}},
    )

    @app.before_request
    def ensure_preflight_responses():
        if request.method == "OPTIONS" and request.path.startswith("/api/"):
            response = app.make_default_options_response()
            allow_headers = request.headers.get(
                "Access-Control-Request-Headers", app.config["CORS_HEADERS"]
            )
            allow_methods = request.headers.get(
                "Access-Control-Request-Method", "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
            response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
            response.headers["Access-Control-Allow-Headers"] = allow_headers
            response.headers["Access-Control-Allow-Methods"] = allow_methods
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response

    @app.after_request
    def apply_cors_headers(response):
        if request.path.startswith("/api/"):
            response.headers.setdefault("Access-Control-Allow-Origin", "http://localhost:3000")
            response.headers.setdefault("Access-Control-Allow-Headers", app.config["CORS_HEADERS"])
            response.headers.setdefault(
                "Access-Control-Allow-Methods",
                "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            )
            response.headers.setdefault("Access-Control-Allow-Credentials", "true")
        return response

    # Register blueprints
    app.register_blueprint(upload_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(cleaning_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(nlp_bp)
    app.register_blueprint(api_fetch_bp)
    app.register_blueprint(ai_gemini_bp)
    app.register_blueprint(sql_fetch_bp)
    app.register_blueprint(ai_storyboard_gemini)
    app.register_blueprint(ai_storyboard_openai)
    app.register_blueprint(raw_data_bp)
    app.register_blueprint(autopilot_bp)

    @app.route('/', methods=['GET'])
    def home():
        return "Welcome to the AI Data Visualization Tool Backend!"
    print("ai_logic.py LOADED AND ACTIVE")

    # ✅ Custom handler for large uploads
    @app.errorhandler(RequestEntityTooLarge)
    def handle_file_too_large(e):
        return jsonify({
            "error": "File too large",
            "message": f"Maximum upload size is {app.config['MAX_CONTENT_LENGTH'] // (1024*1024)} MB"
        }), 413

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)