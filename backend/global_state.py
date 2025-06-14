# backend/global_state.py
import pandas as pd

# Shared state variables
uploaded_df = None
cleaned_data = None

def set_uploaded_df(df: pd.DataFrame):
    global uploaded_df
    uploaded_df = df

def get_uploaded_df() -> pd.DataFrame:
    return uploaded_df

def set_cleaned_data(data):
    global cleaned_data
    cleaned_data = data

def get_cleaned_data():
    return cleaned_data
