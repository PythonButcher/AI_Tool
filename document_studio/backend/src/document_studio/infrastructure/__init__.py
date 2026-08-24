"""Infrastructure layer — file, database, parser, OCR, and model adapters.

This layer implements concrete adapters for external resources. It may import
third-party libraries relevant to its adapters but must not import FastAPI,
Flask, or any AI_Tool global state.
"""
