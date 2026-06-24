# backend/global_state.py
import pandas as pd

# Shared state variables
uploaded_df = None
cleaned_data = None
semantic_model = None
last_trained_model = None
model_metadata = None
governance_policy = None
governance_readiness = None


def set_uploaded_df(df: pd.DataFrame):
    global uploaded_df, cleaned_data, semantic_model, last_trained_model, model_metadata, governance_policy, governance_readiness
    uploaded_df = df
    # New dataset supersedes all downstream artifacts.
    cleaned_data = None
    semantic_model = None
    last_trained_model = None
    model_metadata = None
    governance_policy = None
    governance_readiness = None


def get_uploaded_df() -> pd.DataFrame:
    return uploaded_df


def set_cleaned_data(data):
    global cleaned_data
    cleaned_data = data


def get_cleaned_data():
    return cleaned_data


def set_semantic_model(model):
    global semantic_model
    semantic_model = model


def get_semantic_model():
    return semantic_model


def set_governance_state(policy, readiness):
    """Keep the active dataset policy beside the dataframe it was evaluated against."""
    global governance_policy, governance_readiness
    governance_policy = policy
    governance_readiness = readiness


def get_governance_policy():
    return governance_policy


def get_governance_readiness():
    return governance_readiness


def set_trained_model(model, metadata):
    global last_trained_model, model_metadata
    last_trained_model = model
    model_metadata = metadata


def get_trained_model():
    return last_trained_model, model_metadata
