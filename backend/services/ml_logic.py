import pandas as pd
from sklearn.ensemble import IsolationForest
from typing import Optional, List


def detect_anomalies(df: pd.DataFrame, contamination: Optional[float] = None) -> List[int]:
    """
    Detect anomalies in the provided dataframe using IsolationForest.

    - Operates on numeric columns only
    - Imputes missing values with column means (fallback 0 for all-null columns)
    - Raises ValueError if no numeric columns are available
    """
    if df is None:
        raise ValueError("No dataframe provided for anomaly detection.")

    numeric_df = df.select_dtypes(include='number')
    if numeric_df.empty:
        raise ValueError("No numeric columns available for anomaly detection.")

    mean_values = {}
    for col in numeric_df.columns:
        mean_val = numeric_df[col].mean()
        if pd.isna(mean_val):
            mean_val = 0
        mean_values[col] = mean_val

    filled_df = numeric_df.fillna(mean_values)
    model = IsolationForest(contamination=contamination if contamination is not None else 0.05, random_state=42)
    predictions = model.fit_predict(filled_df)
    outlier_indices = filled_df.index[predictions == -1].tolist()

    return outlier_indices
