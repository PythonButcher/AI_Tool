import pandas as pd
from typing import Optional, List

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
except ModuleNotFoundError:
    IsolationForest = None
    StandardScaler = None


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

    if IsolationForest is None or StandardScaler is None:
        return _detect_anomalies_without_sklearn(numeric_df, contamination=contamination)

    mean_values = {}
    for col in numeric_df.columns:
        mean_val = numeric_df[col].mean()
        if pd.isna(mean_val):
            mean_val = 0
        mean_values[col] = mean_val

    filled_df = numeric_df.fillna(mean_values)

    scaler = StandardScaler()
    scaled_values = scaler.fit_transform(filled_df)

    model = IsolationForest(
        contamination=contamination if contamination is not None else 0.02,
        random_state=42
    )
    predictions = model.fit_predict(scaled_values)
    outlier_indices = filled_df.index[predictions == -1].tolist()

    return outlier_indices


def _detect_anomalies_without_sklearn(
    numeric_df: pd.DataFrame,
    contamination: Optional[float] = None,
) -> List[int]:
    """
    Provide a deterministic fallback when scikit-learn is not installed.

    The fallback uses mean absolute z-score across numeric columns. It is not a
    replacement for IsolationForest, but it preserves backend availability and
    keeps diagnostics conservative in lightweight test/runtime environments.
    """
    mean_values = {}
    for col in numeric_df.columns:
        mean_val = numeric_df[col].mean()
        if pd.isna(mean_val):
            mean_val = 0
        mean_values[col] = mean_val

    filled_df = numeric_df.fillna(mean_values)
    if filled_df.empty:
        return []

    z_scores = pd.DataFrame(index=filled_df.index)
    for col in filled_df.columns:
        std = filled_df[col].std()
        if pd.isna(std) or std == 0:
            z_scores[col] = 0.0
        else:
            z_scores[col] = ((filled_df[col] - filled_df[col].mean()) / std).abs()

    anomaly_scores = z_scores.mean(axis=1)
    if anomaly_scores.empty:
        return []

    requested_share = contamination if contamination is not None else 0.02
    requested_share = max(0.0, min(float(requested_share), 0.5))
    candidate_count = max(1, round(len(anomaly_scores.index) * requested_share))
    ranked = anomaly_scores.sort_values(ascending=False)
    threshold = max(2.5, float(ranked.iloc[min(candidate_count - 1, len(ranked.index) - 1)]))
    return ranked[ranked >= threshold].index.tolist()
