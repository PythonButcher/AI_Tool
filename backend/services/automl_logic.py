from __future__ import annotations

import uuid
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from backend.services.model_training import ModelTrainingError, RegressionStrategy
from backend.utils.global_state import set_trained_model


class AutoMLService:
    @staticmethod
    def _safe_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            parsed = float(value)
            if np.isfinite(parsed):
                return parsed
        except (TypeError, ValueError):
            return None
        return None

    @staticmethod
    def detect_problem_type(df: pd.DataFrame, target_column: str) -> str:
        """
        Determine whether target should be modeled as regression or classification.
        """
        target = df[target_column].dropna()
        if target.empty:
            raise ModelTrainingError("Target column contains only missing values.")

        if (
            pd.api.types.is_object_dtype(target)
            or pd.api.types.is_categorical_dtype(target)
            or pd.api.types.is_bool_dtype(target)
        ):
            return "classification"

        numeric_target = pd.to_numeric(target, errors="coerce")
        numeric_ratio = float(numeric_target.notna().mean())
        unique_count = int(target.nunique(dropna=True))

        # Mostly non-numeric -> treat as categorical labels.
        if numeric_ratio < 0.95:
            return "classification"

        numeric_values = numeric_target.dropna().to_numpy(dtype=float)
        integer_like = bool(np.all(np.isclose(numeric_values, np.round(numeric_values), atol=1e-9)))
        unique_ratio = unique_count / max(len(target), 1)

        # Numeric targets are classification only if clearly label-like.
        if integer_like and unique_count <= 12 and unique_ratio <= 0.2:
            return "classification"

        return "regression"

    @staticmethod
    def get_candidate_models(problem_type: str) -> List[Dict[str, Any]]:
        if problem_type == "regression":
            return [
                {"name": "Linear Regression", "model": LinearRegression(), "id": "linear_regression"},
                {
                    "name": "Random Forest Regressor",
                    "model": RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1),
                    "id": "rf_regressor",
                },
                {
                    "name": "Gradient Boosting Regressor",
                    "model": HistGradientBoostingRegressor(random_state=42),
                    "id": "gb_regressor",
                },
            ]

        return [
            {
                "name": "Logistic Regression",
                "model": LogisticRegression(max_iter=2000, random_state=42),
                "id": "logistic_regression",
            },
            {
                "name": "Random Forest Classifier",
                "model": RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1),
                "id": "rf_classifier",
            },
            {
                "name": "Gradient Boosting Classifier",
                "model": HistGradientBoostingClassifier(random_state=42),
                "id": "gb_classifier",
            },
        ]

    @staticmethod
    def evaluate_model(model: Pipeline, X_test: pd.DataFrame, y_test: pd.Series, problem_type: str) -> Tuple[Dict[str, Any], np.ndarray]:
        predictions = model.predict(X_test)

        if problem_type == "regression":
            mse_value = mean_squared_error(y_test, predictions)
            return {
                "r2": float(r2_score(y_test, predictions)),
                "mae": float(mean_absolute_error(y_test, predictions)),
                "rmse": float(np.sqrt(mse_value)),
            }, predictions

        return {
            "accuracy": float(accuracy_score(y_test, predictions)),
            "f1": float(f1_score(y_test, predictions, average="weighted", zero_division=0)),
            "precision": float(precision_score(y_test, predictions, average="weighted", zero_division=0)),
            "recall": float(recall_score(y_test, predictions, average="weighted", zero_division=0)),
        }, predictions

    @staticmethod
    def _display_feature_name(raw_name: str) -> str:
        if raw_name.startswith("num__"):
            return raw_name.replace("num__", "", 1)
        if raw_name.startswith("cat__"):
            cleaned = raw_name.replace("cat__", "", 1)
            if "_" in cleaned:
                col, value = cleaned.split("_", 1)
                return f"{col}={value}"
            return cleaned
        return raw_name

    @staticmethod
    def _extract_feature_importance(pipeline: Pipeline, top_k: int = 8) -> List[Dict[str, Any]]:
        try:
            preprocessor = pipeline.named_steps["preprocessor"]
            model = pipeline.named_steps["model"]
            feature_names = preprocessor.get_feature_names_out()
        except Exception:
            return []

        values = None
        if hasattr(model, "feature_importances_"):
            values = getattr(model, "feature_importances_")
        elif hasattr(model, "coef_"):
            coef = np.asarray(getattr(model, "coef_"))
            if coef.ndim == 2:
                coef = np.mean(np.abs(coef), axis=0)
            else:
                coef = np.abs(coef)
            values = coef

        if values is None:
            return []

        importances = np.asarray(values).flatten()
        if importances.shape[0] != len(feature_names):
            return []

        order = np.argsort(importances)[::-1][:top_k]
        return [
            {
                "feature": AutoMLService._display_feature_name(str(feature_names[idx])),
                "importance": float(importances[idx]),
            }
            for idx in order
            if np.isfinite(importances[idx])
        ]

    @staticmethod
    def _build_baseline_metrics(problem_type: str, y_train: pd.Series, y_test: pd.Series) -> Dict[str, Any]:
        if problem_type == "regression":
            baseline_val = float(pd.to_numeric(y_train, errors="coerce").mean())
            baseline_preds = np.full(shape=len(y_test), fill_value=baseline_val, dtype=float)
            mse_value = mean_squared_error(y_test, baseline_preds)
            return {
                "r2": float(r2_score(y_test, baseline_preds)),
                "mae": float(mean_absolute_error(y_test, baseline_preds)),
                "rmse": float(np.sqrt(mse_value)),
            }

        majority_class = y_train.value_counts().idxmax()
        baseline_preds = np.full(shape=len(y_test), fill_value=majority_class, dtype=object)
        return {
            "accuracy": float(accuracy_score(y_test, baseline_preds)),
            "f1": float(f1_score(y_test, baseline_preds, average="weighted", zero_division=0)),
            "precision": float(precision_score(y_test, baseline_preds, average="weighted", zero_division=0)),
            "recall": float(recall_score(y_test, baseline_preds, average="weighted", zero_division=0)),
        }

    @staticmethod
    def _quality_statement(problem_type: str, metrics: Dict[str, Any]) -> str:
        if problem_type == "regression":
            r2 = float(metrics.get("r2") or 0.0)
            if r2 >= 0.85:
                return "Strong fit: model explains most variance in the target."
            if r2 >= 0.6:
                return "Moderate fit: model captures useful signal, but can improve."
            if r2 >= 0.3:
                return "Weak-to-moderate fit: use predictions with caution."
            return "Weak fit: current features have limited predictive signal."

        f1 = float(metrics.get("f1") or 0.0)
        if f1 >= 0.85:
            return "Strong classification performance."
        if f1 >= 0.7:
            return "Moderate classification performance."
        if f1 >= 0.5:
            return "Usable but weak classification performance."
        return "Weak classification performance; improve data/features."

    @staticmethod
    def _target_overview(problem_type: str, target: pd.Series) -> Dict[str, Any]:
        if problem_type == "regression":
            y = pd.to_numeric(target, errors="coerce")
            return {
                "mean": AutoMLService._safe_float(y.mean()),
                "median": AutoMLService._safe_float(y.median()),
                "min": AutoMLService._safe_float(y.min()),
                "max": AutoMLService._safe_float(y.max()),
                "std": AutoMLService._safe_float(y.std()),
            }

        counts = target.astype(str).value_counts(dropna=False)
        top = counts.head(5).to_dict()
        return {
            "class_count": int(counts.shape[0]),
            "top_classes": {str(k): int(v) for k, v in top.items()},
        }

    @staticmethod
    def _correlation_findings(features: pd.DataFrame, target: pd.Series, max_items: int = 3) -> List[str]:
        findings: List[str] = []
        numeric_cols = features.select_dtypes(include=["number", "bool"]).columns.tolist()
        if not numeric_cols:
            return findings

        y = pd.to_numeric(target, errors="coerce")
        corr_rows: List[Tuple[str, float]] = []

        for col in numeric_cols:
            x = pd.to_numeric(features[col], errors="coerce")
            mask = x.notna() & y.notna()
            if int(mask.sum()) < 5:
                continue
            corr = x[mask].corr(y[mask])
            if pd.notna(corr):
                corr_rows.append((col, float(corr)))

        corr_rows.sort(key=lambda item: abs(item[1]), reverse=True)
        for col, corr in corr_rows[:max_items]:
            direction = "positive" if corr >= 0 else "negative"
            findings.append(f"{col} has a {direction} relationship with the target (corr={corr:.3f}).")

        return findings

    @staticmethod
    def _prediction_preview(y_test: pd.Series, y_pred: np.ndarray, max_rows: int = 5) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        for actual, predicted in list(zip(y_test.tolist(), y_pred.tolist()))[:max_rows]:
            rows.append({"actual": actual, "predicted": predicted})
        return rows

    @staticmethod
    def _build_insights(
        problem_type: str,
        target_column: str,
        best_model_name: str,
        best_metrics: Dict[str, Any],
        baseline_metrics: Dict[str, Any],
        feature_importance: List[Dict[str, Any]],
        features: pd.DataFrame,
        target: pd.Series,
    ) -> Dict[str, Any]:
        findings: List[str] = []

        if problem_type == "regression":
            baseline_rmse = baseline_metrics.get("rmse")
            model_rmse = best_metrics.get("rmse")
            if baseline_rmse and model_rmse:
                improvement = ((baseline_rmse - model_rmse) / baseline_rmse) * 100
                findings.append(f"RMSE improved by {improvement:.1f}% vs mean-value baseline.")
            findings.extend(AutoMLService._correlation_findings(features, target))
        else:
            base_f1 = baseline_metrics.get("f1")
            model_f1 = best_metrics.get("f1")
            if base_f1 is not None and model_f1 is not None:
                findings.append(f"F1 comparison: model={model_f1:.3f}, baseline={base_f1:.3f}.")

        if feature_importance:
            top = feature_importance[0]
            findings.append(f"Top driver: {top['feature']} (importance={top['importance']:.4f}).")

        return {
            "overview": f"Target '{target_column}' modeled as {problem_type} using {best_model_name}.",
            "quality_assessment": AutoMLService._quality_statement(problem_type, best_metrics),
            "target_overview": AutoMLService._target_overview(problem_type, target),
            "baseline_metrics": baseline_metrics,
            "key_findings": findings,
        }

    @staticmethod
    def train_automl(df: pd.DataFrame, target_column: str, test_size: float = 0.2) -> Dict[str, Any]:
        if df is None or df.empty:
            raise ModelTrainingError("No dataset provided.")

        if target_column not in df.columns:
            raise ModelTrainingError(f"Target column '{target_column}' not found.")

        try:
            test_size = float(test_size)
        except (TypeError, ValueError) as exc:
            raise ModelTrainingError("test_size must be a number between 0.1 and 0.5.") from exc

        if test_size < 0.1 or test_size > 0.5:
            raise ModelTrainingError("test_size must be between 0.1 and 0.5.")

        warnings: List[str] = []

        working_df = df.copy()

        for col in list(working_df.columns):
            if col == target_column:
                continue

            if working_df[col].isna().all():
                working_df.drop(columns=[col], inplace=True)
                continue

            if pd.api.types.is_object_dtype(working_df[col]):
                unique_ratio = working_df[col].nunique(dropna=True) / max(len(working_df), 1)
                if unique_ratio > 0.9 and working_df[col].nunique(dropna=True) > 20:
                    working_df.drop(columns=[col], inplace=True)

        problem_type = AutoMLService.detect_problem_type(working_df, target_column)

        feature_columns = [col for col in working_df.columns if col != target_column]
        X = working_df[feature_columns].copy()
        y = working_df[target_column].copy()

        mask = y.notna()
        X = X[mask]
        y = y[mask]

        if problem_type == "regression":
            y_numeric = pd.to_numeric(y, errors="coerce")
            valid_numeric = y_numeric.notna()
            X = X[valid_numeric]
            y = y_numeric[valid_numeric]
        else:
            y = y.astype(str)

        if len(X) < 10:
            raise ModelTrainingError("Dataset is too small for reliable training (min 10 non-null target rows).")
        if len(X) < 50:
            warnings.append(
                f"Only {len(X)} rows available. Metrics may be unstable; more rows are recommended for reliable insights."
            )

        stratify = None
        if problem_type == "classification":
            class_counts = y.value_counts()
            if not class_counts.empty and class_counts.min() >= 2 and y.nunique() <= 25:
                stratify = y

        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42, stratify=stratify
            )
        except ValueError:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42, stratify=None
            )

        candidates = AutoMLService.get_candidate_models(problem_type)

        baseline_metrics = AutoMLService._build_baseline_metrics(problem_type, y_train, y_test)

        results: List[Dict[str, Any]] = []
        best_score = -float("inf")
        best_model_info = None
        best_pipeline = None
        best_predictions = None

        for candidate in candidates:
            try:
                preprocessor = RegressionStrategy._build_feature_preprocessor(X_train)
                pipeline = Pipeline([
                    ("preprocessor", preprocessor),
                    ("model", candidate["model"]),
                ])

                pipeline.fit(X_train, y_train)
                metrics, predictions = AutoMLService.evaluate_model(pipeline, X_test, y_test, problem_type)

                score = metrics["r2"] if problem_type == "regression" else metrics["f1"]

                results.append(
                    {
                        "model_id": candidate["id"],
                        "model_name": candidate["name"],
                        "metrics": metrics,
                        "score": score,
                    }
                )

                if score > best_score:
                    best_score = score
                    best_model_info = {
                        "model_id": candidate["id"],
                        "model_name": candidate["name"],
                        "metrics": metrics,
                        "score": score,
                    }
                    best_pipeline = pipeline
                    best_predictions = predictions
            except Exception as exc:
                print(f"Error training {candidate['name']}: {exc}")
                continue

        if not results or best_model_info is None or best_pipeline is None or best_predictions is None:
            raise ModelTrainingError("All candidate models failed to train.")

        feature_importance = AutoMLService._extract_feature_importance(best_pipeline)
        insights = AutoMLService._build_insights(
            problem_type=problem_type,
            target_column=target_column,
            best_model_name=best_model_info["model_name"],
            best_metrics=best_model_info["metrics"],
            baseline_metrics=baseline_metrics,
            feature_importance=feature_importance,
            features=X,
            target=y,
        )

        run_id = str(uuid.uuid4())

        set_trained_model(
            best_pipeline,
            {
                "run_id": run_id,
                "model_id": best_model_info["model_id"],
                "model_name": best_model_info["model_name"],
                "problem_type": problem_type,
                "target_column": target_column,
                "feature_columns": feature_columns,
            },
        )

        return {
            "run_id": run_id,
            "problem_type": problem_type,
            "target_column": target_column,
            "best_model": best_model_info,
            "all_models": results,
            "feature_importance": feature_importance,
            "insights": insights,
            "prediction_preview": AutoMLService._prediction_preview(y_test, best_predictions),
            "training_summary": {
                "rows_used": int(len(X)),
                "feature_columns": int(len(feature_columns)),
                "train_rows": int(len(X_train)),
                "test_rows": int(len(X_test)),
                "test_split": test_size,
                "warnings": warnings,
            },
            "summary": f"AutoML trained {len(results)} models for a {problem_type} task.",
        }
