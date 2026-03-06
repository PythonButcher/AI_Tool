from __future__ import annotations

import pandas as pd
import numpy as np
from typing import Any, Dict, List, Optional, Tuple
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, HistGradientBoostingRegressor, HistGradientBoostingClassifier
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    mean_absolute_error, mean_squared_error, r2_score
)
from sklearn.pipeline import Pipeline
from backend.services.model_training import RegressionStrategy, ModelTrainingError
from backend.utils.global_state import set_trained_model

class AutoMLService:
    @staticmethod
    def detect_problem_type(df: pd.DataFrame, target_column: str) -> str:
        """
        Automatically determine if the task is Regression or Classification.
        """
        target = df[target_column].dropna()
        
        if target.dtype == 'object' or target.dtype.name == 'category' or target.dtype == 'bool':
            return "classification"
        
        # If numeric, check number of unique values
        unique_count = target.nunique()
        if unique_count < 20: # Heuristic for small unique counts in numeric columns
            return "classification"
        
        return "regression"

    @staticmethod
    def get_candidate_models(problem_type: str) -> List[Dict[str, Any]]:
        """
        Return a list of candidate models for the given problem type.
        """
        if problem_type == "regression":
            return [
                {"name": "Linear Regression", "model": LinearRegression(), "id": "linear_regression"},
                {"name": "Random Forest Regressor", "model": RandomForestRegressor(n_estimators=100, random_state=42), "id": "rf_regressor"},
                {"name": "Gradient Boosting Regressor", "model": HistGradientBoostingRegressor(random_state=42), "id": "gb_regressor"}
            ]
        else: # classification
            return [
                {"name": "Logistic Regression", "model": LogisticRegression(max_iter=1000, random_state=42), "id": "logistic_regression"},
                {"name": "Random Forest Classifier", "model": RandomForestClassifier(n_estimators=100, random_state=42), "id": "rf_classifier"},
                {"name": "Gradient Boosting Classifier", "model": HistGradientBoostingClassifier(random_state=42), "id": "gb_classifier"}
            ]

    @staticmethod
    def evaluate_model(model: Pipeline, X_test: pd.DataFrame, y_test: pd.Series, problem_type: str) -> Dict[str, Any]:
        """
        Evaluate a model and return metrics.
        """
        predictions = model.predict(X_test)
        
        if problem_type == "regression":
            return {
                "r2": float(r2_score(y_test, predictions)),
                "mae": float(mean_absolute_error(y_test, predictions)),
                "rmse": float(np.sqrt(mean_squared_error(y_test, predictions)))
            }
        else: # classification
            return {
                "accuracy": float(accuracy_score(y_test, predictions)),
                "f1": float(f1_score(y_test, predictions, average="weighted", zero_division=0)),
                "precision": float(precision_score(y_test, predictions, average="weighted", zero_division=0)),
                "recall": float(recall_score(y_test, predictions, average="weighted", zero_division=0))
            }

    @staticmethod
    def train_automl(df: pd.DataFrame, target_column: str, test_size: float = 0.2) -> Dict[str, Any]:
        """
        Main entry point for AutoML training.
        """
        if df is None or df.empty:
            raise ModelTrainingError("No dataset provided.")
        
        if target_column not in df.columns:
            raise ModelTrainingError(f"Target column '{target_column}' not found.")

        # 1. Pre-filter columns (drop all-null or extremely high cardinality text columns)
        working_df = df.copy()
        for col in working_df.columns:
            if col == target_column:
                continue
            
            # Drop all-null columns
            if working_df[col].isna().all():
                working_df.drop(columns=[col], inplace=True)
                continue
                
            # Drop high cardinality object columns (potential IDs)
            if working_df[col].dtype == 'object':
                unique_ratio = working_df[col].nunique() / len(working_df)
                if unique_ratio > 0.9 and working_df[col].nunique() > 20:
                    working_df.drop(columns=[col], inplace=True)
                    continue

        # 2. Detect Problem Type
        problem_type = AutoMLService.detect_problem_type(working_df, target_column)
        
        # 3. Prepare Features and Target
        feature_columns = [col for col in working_df.columns if col != target_column]
        X = working_df[feature_columns]
        y = working_df[target_column]
        
        # Handle target NaNs
        mask = y.notna()
        X = X[mask]
        y = y[mask]
        
        if len(X) < 10:
            raise ModelTrainingError("Dataset is too small for reliable training (min 10 non-null target rows).")

        # 3. Train/Test Split
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)

        # 4. Candidate Models
        candidates = AutoMLService.get_candidate_models(problem_type)
        
        # 5. Preprocessor (reusing existing logic)
        # Note: RegressionStrategy._build_feature_preprocessor handles both num and cat features
        preprocessor = RegressionStrategy._build_feature_preprocessor(X_train)
        
        results = []
        best_score = -float('inf')
        best_model_info = None
        
        for candidate in candidates:
            try:
                pipeline = Pipeline([
                    ("preprocessor", preprocessor),
                    ("model", candidate["model"])
                ])
                
                pipeline.fit(X_train, y_train)
                metrics = AutoMLService.evaluate_model(pipeline, X_test, y_test, problem_type)
                
                score = metrics["r2"] if problem_type == "regression" else metrics["f1"]
                
                results.append({
                    "model_id": candidate["id"],
                    "model_name": candidate["name"],
                    "metrics": metrics,
                    "score": score
                })
                
                if score > best_score:
                    best_score = score
                    best_model_info = {
                        "model_id": candidate["id"],
                        "model_name": candidate["name"],
                        "metrics": metrics
                    }
                    # Save winning model to global state for future predictions
                    set_trained_model(pipeline, {
                        "model_id": candidate["id"],
                        "model_name": candidate["name"],
                        "problem_type": problem_type,
                        "target_column": target_column,
                        "feature_columns": feature_columns
                    })
            except Exception as e:
                print(f"Error training {candidate['name']}: {e}")
                continue

        if not results:
            raise ModelTrainingError("All candidate models failed to train.")

        return {
            "problem_type": problem_type,
            "target_column": target_column,
            "best_model": best_model_info,
            "all_models": results,
            "summary": f"AutoML successfully trained {len(results)} models for {problem_type} task."
        }
