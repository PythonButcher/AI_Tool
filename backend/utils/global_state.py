# backend/global_state.py
import pandas as pd

# Shared state variables
uploaded_df = None
cleaned_data = None
last_trained_model = None
model_metadata = None


def set_uploaded_df(df: pd.DataFrame):
    global uploaded_df, cleaned_data, last_trained_model, model_metadata
    uploaded_df = df
    # New dataset supersedes all downstream artifacts.
    cleaned_data = None
    last_trained_model = None
    model_metadata = None


def get_uploaded_df() -> pd.DataFrame:
    return uploaded_df


def set_cleaned_data(data):
    global cleaned_data
    cleaned_data = data


def get_cleaned_data():
    return cleaned_data


def set_trained_model(model, metadata):
    global last_trained_model, model_metadata
    last_trained_model = model
    model_metadata = metadata


def get_trained_model():
    return last_trained_model, model_metadata
