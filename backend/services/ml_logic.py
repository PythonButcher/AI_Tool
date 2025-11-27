from sklearn.ensemble import IsolationForest
import pandas as pd
import numpy as np

def detect_anomalies(df: pd.DataFrame, contamination: float = 0.05) -> list:
    """
    Detects anomalies in a pandas DataFrame using Isolation Forest.

    Args:
        df (pd.DataFrame): The input DataFrame.
        contamination (float): The proportion of outliers in the data set. 
                               Used to define the threshold on the scores of the samples.

    Returns:
        list: A list of indices (row numbers) that are considered outliers.
    """
    # 1. Select only numeric columns
    numeric_df = df.select_dtypes(include=[np.number])

    # Handle case with no numeric columns
    if numeric_df.empty:
        raise ValueError("Dataset has no numeric columns for anomaly detection.")

    # 2. Handle NaN values (Simple Imputation with Mean)
    # We use a copy to avoid modifying the original dataframe if it was passed by reference
    numeric_df_imputed = numeric_df.fillna(numeric_df.mean())
    
    # Check if there are still NaNs (e.g., if a column was all NaNs)
    # If a column is all NaNs, mean() is NaN. We fill those with 0.
    numeric_df_imputed = numeric_df_imputed.fillna(0)

    # 3. Initialize and Fit IsolationForest
    # random_state for reproducibility
    iso_forest = IsolationForest(contamination=contamination, random_state=42)
    
    # Fit the model
    iso_forest.fit(numeric_df_imputed)

    # 4. Predict outliers
    # Returns -1 for outliers and 1 for inliers.
    predictions = iso_forest.predict(numeric_df_imputed)

    # 5. Extract indices of outliers
    # We want the original indices from the dataframe
    outlier_indices = df.index[predictions == -1].tolist()

    return outlier_indices
