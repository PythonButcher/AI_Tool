import os
import google.generativeai as genai

class Config:
    # API Keys
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("❌ OPENAI_API_KEY is not set.")

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        raise ValueError("❌ GEMINI_API_KEY is not set.")
    genai.configure(api_key=GEMINI_API_KEY)  # ✅ Centralized config at import-time

    # Model Names
    OPENAI_MODEL_NAME = "gpt-4o-mini"
    GEMINI_MODEL_NAME = "gemini-1.5-flash"

    # Defaults
    DEFAULT_AI_MODEL = "openai"
    AI_TIMEOUT_SECONDS = 10

    # OpenAI Completion Settings
    OPENAI_COMPLETION_CONFIG = {
        "max_tokens": 500,
        "temperature": 0.7,
        "top_p": 1,
        "frequency_penalty": 0.5,
        "presence_penalty": 0.6,
    }

    # Gemini: structured GenerationConfig objects
    GEMINI_CONFIG_CHAT = genai.types.GenerationConfig(
        max_output_tokens=500,
        temperature=0.7,
        top_p=1.0,
    )
    GEMINI_CONFIG_CMD = genai.types.GenerationConfig(
        max_output_tokens=300,
        temperature=0.7,
    )
    GEMINI_CONFIG_JSON = genai.types.GenerationConfig(
        max_output_tokens=300,
        temperature=0.2,
        response_mime_type="application/json",
    )
