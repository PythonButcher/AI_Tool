from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

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
    n_clusters: Optional[int] = None
    feature_columns: Optional[List[str]] = None


@dataclass
class TrainingResult:
    metrics: Dict[str, Any]
    visualization: Dict[str, Any]
    predictions: List[Any]


class ModelTrainingError(ValueError):
    """Raised when model training cannot proceed due to invalid input."""


class ModelTrainerStrategy(ABC):
    """Base strategy for all model trainers."""

    @abstractmethod
    def train(self, dataset: pd.DataFrame, config: TrainingRequest) -> TrainingResult:
        """Train a model and return standardized output."""


class ClusteringStrategy(ModelTrainerStrategy):
    """K-means training strategy with silhouette-based auto-tuning."""

    @staticmethod
    def _resolve_feature_columns(dataset: pd.DataFrame, config: TrainingRequest) -> List[str]:
        feature_columns = config.feature_columns or list(dataset.columns)
        missing = [col for col in feature_columns if col not in dataset.columns]
        if missing:
            raise ModelTrainingError(f"Feature columns not found in dataset: {missing}")
        if not feature_columns:
            raise ModelTrainingError("At least one feature column is required for clustering.")
        return feature_columns

    @staticmethod
    def _prepare_features(dataset: pd.DataFrame, feature_columns: List[str]) -> pd.DataFrame:
        feature_df = dataset[feature_columns].copy()
        non_numeric = [col for col in feature_df.columns if not pd.api.types.is_numeric_dtype(feature_df[col])]
        if non_numeric:
            raise ModelTrainingError(
                f"K-means requires numeric feature columns. Non-numeric columns: {non_numeric}"
            )

        imputer = SimpleImputer(strategy="median")
        imputed_values = imputer.fit_transform(feature_df)
        return pd.DataFrame(imputed_values, columns=feature_columns, index=feature_df.index)

    @staticmethod
    def _choose_cluster_count(features: pd.DataFrame) -> int:
        n_samples = len(features)
        if n_samples < 3:
            raise ModelTrainingError("K-means auto-tuning requires at least 3 rows.")

        max_k = min(10, n_samples - 1)
        if max_k < 2:
            raise ModelTrainingError("Not enough rows to evaluate k-means clusters.")

        scaler = StandardScaler()
        scaled = scaler.fit_transform(features)

        best_k = None
        best_score = float("-inf")

        for k in range(2, max_k + 1):
            model = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = model.fit_predict(scaled)
            if len(set(labels)) < 2:
                continue
            score = silhouette_score(scaled, labels)
            if score > best_score:
                best_score = score
                best_k = k

        if best_k is None:
            raise ModelTrainingError("Unable to determine an optimal cluster count from silhouette scores.")

        return best_k

    def train(self, dataset: pd.DataFrame, config: TrainingRequest) -> TrainingResult:
        feature_columns = self._resolve_feature_columns(dataset, config)
        feature_df = self._prepare_features(dataset, feature_columns)

        n_clusters = config.n_clusters
        if n_clusters is None:
            n_clusters = self._choose_cluster_count(feature_df)

        if n_clusters < 2:
            raise ModelTrainingError("K-means requires n_clusters to be at least 2.")
        if len(feature_df) < n_clusters:
            raise ModelTrainingError("Number of clusters cannot exceed number of rows.")

        pipeline = Pipeline(
            steps=[
                ("scaler", StandardScaler()),
                ("model", KMeans(n_clusters=n_clusters, random_state=42, n_init=10)),
            ]
        )
        pipeline.fit(feature_df)

        model: KMeans = pipeline.named_steps["model"]
        scaler: StandardScaler = pipeline.named_steps["scaler"]

        assignments = model.labels_.tolist()
        centers_original_scale = scaler.inverse_transform(model.cluster_centers_)
        centroids = [
            {col: float(center[idx]) for idx, col in enumerate(feature_columns)}
            for center in centers_original_scale
        ]

        silhouette = None
        if len(set(assignments)) > 1:
            silhouette = float(silhouette_score(scaler.transform(feature_df), assignments))

        return TrainingResult(
            metrics={
                "inertia": float(model.inertia_),
                "silhouette_score": silhouette,
                "n_clusters": int(n_clusters),
            },
            visualization={
                "centroids": centroids,
                "feature_columns": feature_columns,
            },
            predictions=[int(value) for value in assignments],
        )


class RegressionStrategy(ModelTrainerStrategy):
    """Linear and logistic regression training strategy."""

    @staticmethod
    def _resolve_columns(dataset: pd.DataFrame, config: TrainingRequest) -> tuple[List[str], str]:
        if not config.target_column:
            raise ModelTrainingError("target_column is required for regression/classification models.")
        if config.target_column not in dataset.columns:
            raise ModelTrainingError(f"Target column '{config.target_column}' does not exist in the dataset.")

        feature_columns = (
            [col for col in config.feature_columns if col != config.target_column]
            if config.feature_columns
            else [col for col in dataset.columns if col != config.target_column]
        )

        missing = [col for col in feature_columns if col not in dataset.columns]
        if missing:
            raise ModelTrainingError(f"Feature columns not found in dataset: {missing}")
        if not feature_columns:
            raise ModelTrainingError("At least one feature column is required.")

        return feature_columns, config.target_column

    @staticmethod
    def _build_feature_preprocessor(feature_df: pd.DataFrame) -> ColumnTransformer:
        numeric_cols = feature_df.select_dtypes(include="number").columns.tolist()
        categorical_cols = [col for col in feature_df.columns if col not in numeric_cols]

        transformers = []
        if numeric_cols:
            transformers.append(
                (
                    "num",
                    Pipeline(
                        steps=[
                            ("imputer", SimpleImputer(strategy="median")),
                            ("scaler", StandardScaler()),
                        ]
                    ),
                    numeric_cols,
                )
            )

        if categorical_cols:
            transformers.append(
                (
                    "cat",
                    Pipeline(
                        steps=[
                            ("imputer", SimpleImputer(strategy="most_frequent")),
                            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                        ]
                    ),
                    categorical_cols,
                )
            )

        if not transformers:
            raise ModelTrainingError("Dataset does not contain usable feature columns.")

        return ColumnTransformer(transformers=transformers)

    @staticmethod
    def _train_linear(feature_df: pd.DataFrame, target: pd.Series) -> TrainingResult:
        numeric_target = pd.to_numeric(target, errors="coerce")
        if numeric_target.isna().any():
            raise ModelTrainingError("Linear regression target must be numeric.")

        preprocessor = RegressionStrategy._build_feature_preprocessor(feature_df)
        pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("model", LinearRegression()),
            ]
        )
        pipeline.fit(feature_df, numeric_target)
        predictions = pipeline.predict(feature_df)

        model: LinearRegression = pipeline.named_steps["model"]
        feature_names = pipeline.named_steps["preprocessor"].get_feature_names_out().tolist()
        coefficients = {
            name: float(coef) for name, coef in zip(feature_names, model.coef_, strict=False)
        }

        return TrainingResult(
            metrics={
                "r2": float(r2_score(numeric_target, predictions)),
                "mae": float(mean_absolute_error(numeric_target, predictions)),
                "mse": float(mean_squared_error(numeric_target, predictions)),
            },
            visualization={
                "coefficients": coefficients,
                "intercept": float(model.intercept_),
                "feature_names": feature_names,
            },
            predictions=[float(value) for value in predictions.tolist()],
        )

    @staticmethod
    def _train_logistic(feature_df: pd.DataFrame, target: pd.Series) -> TrainingResult:
        if target.dropna().empty:
            raise ModelTrainingError("Target column contains only missing values.")

        filled_target = target.fillna(target.mode().iloc[0] if not target.mode().empty else "missing")
        encoder = LabelEncoder()
        encoded_target = encoder.fit_transform(filled_target.astype(str))
        if len(set(encoded_target)) < 2:
            raise ModelTrainingError("Logistic regression target requires at least two classes.")

        preprocessor = RegressionStrategy._build_feature_preprocessor(feature_df)
        pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("model", LogisticRegression(max_iter=1000)),
            ]
        )
        pipeline.fit(feature_df, encoded_target)

        predicted_numeric = pipeline.predict(feature_df)
        predicted_labels = encoder.inverse_transform(predicted_numeric)
        probabilities = pipeline.predict_proba(feature_df)

        conf = confusion_matrix(encoded_target, predicted_numeric)
        class_labels = [str(label) for label in encoder.classes_.tolist()]
        probability_thresholds = {label: 0.5 for label in class_labels}

        return TrainingResult(
            metrics={
                "accuracy": float(accuracy_score(encoded_target, predicted_numeric)),
                "precision": float(
                    precision_score(encoded_target, predicted_numeric, average="weighted", zero_division=0)
                ),
                "recall": float(
                    recall_score(encoded_target, predicted_numeric, average="weighted", zero_division=0)
                ),
                "f1": float(f1_score(encoded_target, predicted_numeric, average="weighted", zero_division=0)),
                "confusion_matrix": conf.tolist(),
            },
            visualization={
                "classes": class_labels,
                "probability_thresholds": probability_thresholds,
                "decision_rule": "argmax_probability",
                "probabilities": probabilities.tolist(),
            },
            predictions=[str(label) for label in predicted_labels.tolist()],
        )

    def train(self, dataset: pd.DataFrame, config: TrainingRequest) -> TrainingResult:
        feature_columns, target_column = self._resolve_columns(dataset, config)
        feature_df = dataset[feature_columns].copy()
        target = dataset[target_column].copy()

        if config.model_type == "linear_regression":
            return self._train_linear(feature_df, target)
        if config.model_type == "logistic_regression":
            return self._train_logistic(feature_df, target)

        raise ModelTrainingError(f"Unsupported regression model_type '{config.model_type}'.")


def _resolve_strategy(model_type: str) -> ModelTrainerStrategy:
    if model_type == "kmeans":
        return ClusteringStrategy()
    if model_type in {"linear_regression", "logistic_regression"}:
        return RegressionStrategy()
    raise ModelTrainingError(f"Unsupported model_type '{model_type}'.")


def train_model(request: TrainingRequest) -> Dict[str, Any]:
    if request.dataset is None or request.dataset.empty:
        raise ModelTrainingError("A non-empty dataset is required for training.")

    dataset = request.dataset.copy()
    strategy = _resolve_strategy(request.model_type)
    result = strategy.train(dataset, request)

    response = {
        "model_type": request.model_type,
        "metrics": result.metrics,
        "visualization": result.visualization,
        "predictions": result.predictions,
    }

    if request.model_type == "kmeans":
        response["clusters"] = result.predictions

    return response
