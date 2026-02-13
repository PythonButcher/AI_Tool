from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    silhouette_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler


@dataclass
class TrainingRequest:
    dataset: pd.DataFrame
    model_type: str
    target_column: Optional[str] = None
    n_clusters: int = 3


class ModelTrainingError(ValueError):
    """Raised when model training cannot proceed due to invalid input."""


def _split_feature_types(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    categorical_cols = [col for col in df.columns if col not in numeric_cols]
    return numeric_cols, categorical_cols


def _build_preprocessor(feature_df: pd.DataFrame, scale_numeric: bool = True) -> ColumnTransformer:
    numeric_cols, categorical_cols = _split_feature_types(feature_df)

    transformers = []
    if numeric_cols:
        numeric_steps = [("imputer", SimpleImputer(strategy="median"))]
        if scale_numeric:
            numeric_steps.append(("scaler", StandardScaler()))
        transformers.append(("num", Pipeline(steps=numeric_steps), numeric_cols))

    if categorical_cols:
        transformers.append(
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "encoder",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                        ),
                    ]
                ),
                categorical_cols,
            )
        )

    if not transformers:
        raise ModelTrainingError("Dataset does not contain usable feature columns.")

    return ColumnTransformer(transformers=transformers)


def _prepare_target(series: pd.Series, model_type: str) -> tuple[pd.Series, Optional[LabelEncoder]]:
    if series.dropna().empty:
        raise ModelTrainingError("Target column contains only missing values.")

    if model_type == "linear_regression":
        numeric_target = pd.to_numeric(series, errors="coerce")
        if numeric_target.isna().any():
            raise ModelTrainingError("Linear regression target must be numeric.")
        return numeric_target, None

    if model_type == "logistic_regression":
        y_series = series.fillna(series.mode().iloc[0] if not series.mode().empty else "missing")
        label_encoder = LabelEncoder()
        encoded_y = pd.Series(label_encoder.fit_transform(y_series.astype(str)), index=series.index)
        if encoded_y.nunique() < 2:
            raise ModelTrainingError("Logistic regression target requires at least two classes.")
        return encoded_y, label_encoder

    raise ModelTrainingError(f"Unsupported target preparation for model type '{model_type}'.")


def _train_linear_regression(df: pd.DataFrame, target_column: str) -> Dict[str, Any]:
    feature_df = df.drop(columns=[target_column])
    if feature_df.empty:
        raise ModelTrainingError("Linear regression requires at least one feature column.")

    y, _ = _prepare_target(df[target_column], model_type="linear_regression")

    preprocessor = _build_preprocessor(feature_df, scale_numeric=True)
    model = Pipeline(steps=[("preprocessor", preprocessor), ("model", LinearRegression())])
    model.fit(feature_df, y)
    predictions = model.predict(feature_df)

    return {
        "metrics": {
            "r2": float(r2_score(y, predictions)),
            "mae": float(mean_absolute_error(y, predictions)),
            "mse": float(mean_squared_error(y, predictions)),
        },
        "predictions": [float(value) for value in predictions.tolist()],
    }


def _train_logistic_regression(df: pd.DataFrame, target_column: str) -> Dict[str, Any]:
    feature_df = df.drop(columns=[target_column])
    if feature_df.empty:
        raise ModelTrainingError("Logistic regression requires at least one feature column.")

    y, label_encoder = _prepare_target(df[target_column], model_type="logistic_regression")

    preprocessor = _build_preprocessor(feature_df, scale_numeric=True)
    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", LogisticRegression(max_iter=1000)),
        ]
    )
    model.fit(feature_df, y)
    predicted = model.predict(feature_df)

    precision = precision_score(y, predicted, average="weighted", zero_division=0)
    recall = recall_score(y, predicted, average="weighted", zero_division=0)
    f1 = f1_score(y, predicted, average="weighted", zero_division=0)
    conf_matrix = confusion_matrix(y, predicted)

    classes = (
        label_encoder.inverse_transform(sorted(y.unique())).tolist()
        if label_encoder is not None
        else [str(label) for label in sorted(y.unique())]
    )

    return {
        "metrics": {
            "accuracy": float(accuracy_score(y, predicted)),
            "precision": float(precision),
            "recall": float(recall),
            "f1": float(f1),
            "confusion_matrix": conf_matrix.tolist(),
            "classes": [str(label) for label in classes],
        },
        "predictions": [
            str(label_encoder.inverse_transform([int(value)])[0]) if label_encoder is not None else int(value)
            for value in predicted.tolist()
        ],
    }


def _train_kmeans(df: pd.DataFrame, n_clusters: int) -> Dict[str, Any]:
    if n_clusters < 2:
        raise ModelTrainingError("K-means requires n_clusters to be at least 2.")
    if len(df) < n_clusters:
        raise ModelTrainingError("Number of clusters cannot exceed number of rows.")

    preprocessor = _build_preprocessor(df, scale_numeric=True)
    transformed = preprocessor.fit_transform(df)

    model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    assignments = model.fit_predict(transformed)

    silhouette = None
    if len(set(assignments)) > 1:
        silhouette = float(silhouette_score(transformed, assignments))

    return {
        "metrics": {
            "inertia": float(model.inertia_),
            "silhouette_score": silhouette,
            "n_clusters": int(n_clusters),
        },
        "clusters": [int(cluster) for cluster in assignments.tolist()],
    }


def train_model(request_data: TrainingRequest) -> Dict[str, Any]:
    if request_data.dataset is None or request_data.dataset.empty:
        raise ModelTrainingError("A non-empty dataset is required for training.")

    model_type = request_data.model_type
    dataset = request_data.dataset.copy()

    if model_type in {"linear_regression", "logistic_regression"}:
        if not request_data.target_column:
            raise ModelTrainingError("target_column is required for the selected model type.")
        if request_data.target_column not in dataset.columns:
            raise ModelTrainingError(
                f"Target column '{request_data.target_column}' does not exist in the dataset."
            )

    if model_type == "linear_regression":
        result = _train_linear_regression(dataset, request_data.target_column)
    elif model_type == "logistic_regression":
        result = _train_logistic_regression(dataset, request_data.target_column)
    elif model_type == "kmeans":
        result = _train_kmeans(dataset, request_data.n_clusters)
    else:
        raise ModelTrainingError(f"Unsupported model_type '{model_type}'.")

    return {"model_type": model_type, **result}
