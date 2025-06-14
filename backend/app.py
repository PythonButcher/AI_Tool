from flask import Flask
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
import sys
import os


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def create_app():
    app = Flask(__name__)

    # Apply CORS globally to all routes
    CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

    # Register blueprints
    app.register_blueprint(upload_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(cleaning_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(api_fetch_bp)
    app.register_blueprint(ai_gemini_bp)
    app.register_blueprint(sql_fetch_bp)
    app.register_blueprint(ai_storyboard_gemini)
    app.register_blueprint(ai_storyboard_openai)


    @app.route('/', methods=['GET'])
    
    def home():
        return "Welcome to the AI Data Visualization Tool Backend!"
    print("✅ ai_logic.py LOADED AND ACTIVE")

    
    

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)
