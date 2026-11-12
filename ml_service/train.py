"""Train and evaluate the Linear Regression student accuracy predictor."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from db_connector import fetch_all_results_df
from preprocessing import (
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    build_historical_training_dataset,
    clean_quiz_records,
)


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "linear_regression_model.joblib"
METADATA_PATH = MODEL_DIR / "model_metadata.json"

MODEL_NAME = "Linear Regression (Scikit-learn)"
MIN_TRAINING_PAIRS = int(os.getenv("MIN_TRAINING_PAIRS", "10"))
MIN_TRAIN_SAMPLES = 7
MIN_TEST_SAMPLES = 3


def _build_insufficient_metadata(
    total_db_records: int,
    cleaned_records: int,
    usable_training_pairs: int,
    distinct_students: int,
    min_pairs: int,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    default_msg = (
        f"Insufficient real historical training data. Found {total_db_records} quiz "
        f"record(s) in MySQL ({usable_training_pairs} usable multi-attempt training "
        f"pair(s) across {distinct_students} student group(s)); at least {min_pairs} "
        f"historical quiz transitions are required to train and evaluate Linear Regression."
    )
    return {
        "model_name": MODEL_NAME,
        "status": "insufficient_data",
        "trained": False,
        "metrics_valid": False,
        "evaluation_metrics": None,
        "training_summary": {
            "total_db_records": int(total_db_records),
            "cleaned_records": int(cleaned_records),
            "usable_training_pairs": int(usable_training_pairs),
            "distinct_student_groups": int(distinct_students),
            "min_required_pairs": int(min_pairs),
            "train_samples": 0,
            "test_samples": 0,
            "split_strategy": None,
        },
        "features": FEATURE_COLUMNS,
        "target": TARGET_COLUMN,
        "trained_at": None,
        "message": reason or default_msg,
    }


def _persist_metadata(metadata: Dict[str, Any], pipeline: Optional[Pipeline] = None) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if pipeline is not None and metadata.get("trained"):
        joblib.dump(pipeline, MODEL_PATH)
    elif MODEL_PATH.exists():
        MODEL_PATH.unlink()

    with open(METADATA_PATH, "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2)


def load_saved_metadata() -> Optional[Dict[str, Any]]:
    if not METADATA_PATH.exists():
        return None
    with open(METADATA_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _split_dataset(dataset_df: pd.DataFrame):
    """
    Use student-group-aware splitting when enough distinct students exist
    and produce valid train/test sizes; otherwise fall back to strict
    chronological splitting so future quizzes never leak into training.
    """
    n_samples = len(dataset_df)
    distinct_groups = dataset_df["student_group"].nunique()

    if distinct_groups >= 3:
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
        train_idx, test_idx = next(
            splitter.split(
                dataset_df[FEATURE_COLUMNS],
                dataset_df[TARGET_COLUMN],
                groups=dataset_df["student_group"],
            )
        )
        if len(train_idx) >= MIN_TRAIN_SAMPLES and len(test_idx) >= MIN_TEST_SAMPLES:
            return (
                dataset_df.iloc[train_idx].copy(),
                dataset_df.iloc[test_idx].copy(),
                "student_group_aware",
            )

    # Strict chronological split: earliest attempts train, latest attempts test
    split_idx = max(MIN_TRAIN_SAMPLES, int(np.floor(n_samples * 0.8)))
    split_idx = min(split_idx, n_samples - MIN_TEST_SAMPLES)
    return (
        dataset_df.iloc[:split_idx].copy(),
        dataset_df.iloc[split_idx:].copy(),
        "chronological",
    )


def train_from_dataframe(
    raw_df: pd.DataFrame,
    save_artifacts: bool = True,
    min_pairs: int = MIN_TRAINING_PAIRS,
) -> Dict[str, Any]:
    """Train Linear Regression on historical quiz pairs and evaluate honestly."""
    total_db_records = 0 if raw_df is None else len(raw_df)
    cleaned_df = clean_quiz_records(raw_df)
    cleaned_records = len(cleaned_df)
    dataset_df = build_historical_training_dataset(cleaned_df)
    usable_pairs = len(dataset_df)
    distinct_students = (
        int(dataset_df["student_group"].nunique()) if not dataset_df.empty else 0
    )

    if usable_pairs < max(min_pairs, MIN_TRAIN_SAMPLES + MIN_TEST_SAMPLES):
        metadata = _build_insufficient_metadata(
            total_db_records=total_db_records,
            cleaned_records=cleaned_records,
            usable_training_pairs=usable_pairs,
            distinct_students=distinct_students,
            min_pairs=max(min_pairs, MIN_TRAIN_SAMPLES + MIN_TEST_SAMPLES),
        )
        if save_artifacts:
            _persist_metadata(metadata, pipeline=None)
        return metadata

    train_df, test_df, split_strategy = _split_dataset(dataset_df)
    X_train = train_df[FEATURE_COLUMNS]
    y_train = train_df[TARGET_COLUMN].astype(float)
    X_test = test_df[FEATURE_COLUMNS]
    y_test = test_df[TARGET_COLUMN].astype(float)

    if len(X_train) < MIN_TRAIN_SAMPLES or len(X_test) < MIN_TEST_SAMPLES:
        metadata = _build_insufficient_metadata(
            total_db_records=total_db_records,
            cleaned_records=cleaned_records,
            usable_training_pairs=usable_pairs,
            distinct_students=distinct_students,
            min_pairs=max(min_pairs, MIN_TRAIN_SAMPLES + MIN_TEST_SAMPLES),
            reason="Insufficient train/test sample sizes after chronological/group split.",
        )
        if save_artifacts:
            _persist_metadata(metadata, pipeline=None)
        return metadata

    # Pipeline fits imputer & scaler ONLY on X_train (prevents preprocessing leakage)
    pipeline = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
            ("scaler", StandardScaler()),
            ("regressor", LinearRegression()),
        ]
    )
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    mae = float(mean_absolute_error(y_test, y_pred))
    mse = float(mean_squared_error(y_test, y_pred))
    rmse = float(np.sqrt(mse))

    # R² is only meaningful when test targets have non-zero variance
    has_variance = len(y_test) >= 2 and float(np.var(y_test)) > 1e-9
    if has_variance:
        r2 = float(r2_score(y_test, y_pred))
        metrics_valid = True
        evaluation_metrics = {
            "mae": round(mae, 4),
            "mse": round(mse, 4),
            "rmse": round(rmse, 4),
            "r2": round(r2, 4),
        }
    else:
        metrics_valid = False
        evaluation_metrics = None

    regressor = pipeline.named_steps["regressor"]
    coefficients = {
        feat: round(float(coef), 4)
        for feat, coef in zip(FEATURE_COLUMNS, regressor.coef_)
    }

    metadata = {
        "model_name": MODEL_NAME,
        "status": "trained",
        "trained": True,
        "metrics_valid": metrics_valid,
        "evaluation_metrics": evaluation_metrics,
        "training_summary": {
            "total_db_records": int(total_db_records),
            "cleaned_records": int(cleaned_records),
            "usable_training_pairs": int(usable_pairs),
            "distinct_student_groups": int(distinct_students),
            "min_required_pairs": int(max(min_pairs, MIN_TRAIN_SAMPLES + MIN_TEST_SAMPLES)),
            "train_samples": int(len(X_train)),
            "test_samples": int(len(X_test)),
            "split_strategy": split_strategy,
        },
        "features": FEATURE_COLUMNS,
        "target": TARGET_COLUMN,
        "coefficients": coefficients,
        "intercept": round(float(regressor.intercept_), 4),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "message": (
            "Linear Regression model trained and evaluated successfully."
            if metrics_valid
            else "Model trained, but evaluation metrics are unavailable because test target variance is zero."
        ),
    }

    if save_artifacts:
        _persist_metadata(metadata, pipeline=pipeline)

    return metadata


def train_from_mysql(save_artifacts: bool = True) -> Dict[str, Any]:
    """Fetch real quiz records from MySQL and run the training pipeline."""
    raw_df = fetch_all_results_df()
    return train_from_dataframe(raw_df, save_artifacts=save_artifacts)


if __name__ == "__main__":
    result = train_from_mysql(save_artifacts=True)
    print(json.dumps(result, indent=2))
