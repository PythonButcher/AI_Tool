"""Domain layer — portable document and extraction objects.

This layer defines the core business objects (documents, extracted fields,
evidence, confidence) using only the Python standard library. It must not
import FastAPI, Flask, SQLAlchemy, or any AI_Tool state.
"""
