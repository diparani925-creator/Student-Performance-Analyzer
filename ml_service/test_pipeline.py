"""
Isolated unit tests for the ML preprocessing, anti-leakage checks,
Linear Regression training, evaluation metrics, and insufficiency gates.

NOTE: Synthetic records in this file are strictly kept in memory for isolated
pipeline testing and NEVER written to MySQL or saved as production models.
"""

from datetime import datetime, timedelta
import numpy as np
import pandas as pd

from preprocessing import (
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    build_historical_training_dataset,
    clean_quiz_records,
    extract_next_quiz_context,
)
from train import train_from_dataframe


def _make_synthetic_history(num_students=5, attempts_per_student=4):
    rng = np.random.default_rng(42)
    base_time = datetime(2026, 9, 1, 10, 0, 0)
    rows = []
    row_id = 1
    for s in range(num_students):
        acc = 45.0 + s * 5.0
        for a in range(attempts_per_student):
            # Missing avg_time on first student's first attempt to verify imputation
            avg_time = None if (s == 0 and a == 0) else float(round(18.0 - 0.8 * a + rng.normal(0, 1), 2))
            rows.append(
                {
                    "id": row_id,
                    "attempt_id": f"syn_{s}_{a}",
                    "name": f"Student {s}",
                    "currentCourse": "B.Tech",
                    "interestedCourse": "Machine Learning",
                    "score": int(round(acc / 10)),
                    "total_questions": 10,
                    "correct_answers": int(round(acc / 10)),
                    "wrong_answers": 10 - int(round(acc / 10)),
                    "unanswered_count": 0,
                    "accuracy": round(float(np.clip(acc, 0, 100)), 2),
                    "time_taken_sec": None if avg_time is None else int(round(avg_time * 10)),
                    "avg_time_per_question": avg_time,
                    "created_at": base_time + timedelta(days=s * 10 + a),
                }
            )
            acc = np.clip(acc + 6.5 + rng.normal(0, 2.5), 10, 98)
            row_id += 1
    return pd.DataFrame(rows)


def test_prevents_data_leakage_in_historical_features():
    df = pd.DataFrame(
        [
            {
                "id": 1,
                "attempt_id": "a1",
                "name": "Alice",
                "currentCourse": "BCA",
                "interestedCourse": "Python",
                "total_questions": 10,
                "correct_answers": 4,
                "accuracy": 40.0,
                "avg_time_per_question": 12.0,
                "created_at": "2026-10-01 10:00:00",
            },
            {
                "id": 2,
                "attempt_id": "a2",
                "name": "Alice",
                "currentCourse": "BCA",
                "interestedCourse": "Python",
                "total_questions": 10,
                "correct_answers": 6,
                "accuracy": 60.0,
                "avg_time_per_question": 15.0,
                "created_at": "2026-10-02 10:00:00",
            },
            {
                "id": 3,
                "attempt_id": "a3",
                "name": "Alice",
                "currentCourse": "BCA",
                "interestedCourse": "Python",
                "total_questions": 10,
                "correct_answers": 9,
                "accuracy": 90.0,
                "avg_time_per_question": 20.0,
                "created_at": "2026-10-03 10:00:00",
            },
        ]
    )

    dataset = build_historical_training_dataset(df)
    assert len(dataset) == 2

    # Predicting attempt 2 must use ONLY attempt 1
    row_2 = dataset.iloc[0]
    assert row_2["prev_accuracy"] == 40.0
    assert row_2["prev_quiz_performance"] == 40.0
    assert row_2["attempt_count"] == 1
    assert row_2["prev_avg_time"] == 12.0
    assert row_2[TARGET_COLUMN] == 60.0

    # Predicting attempt 3 must use ONLY attempts 1 and 2 (mean=50.0, prev=60.0, time=15.0)
    row_3 = dataset.iloc[1]
    assert row_3["prev_accuracy"] == 60.0
    assert row_3["prev_quiz_performance"] == 50.0
    assert row_3["attempt_count"] == 2
    assert row_3["prev_avg_time"] == 15.0
    assert row_3[TARGET_COLUMN] == 90.0


def test_insufficient_data_does_not_fake_training():
    tiny_df = _make_synthetic_history(num_students=2, attempts_per_student=2)
    result = train_from_dataframe(tiny_df, save_artifacts=False)
    assert result["trained"] is False
    assert result["status"] == "insufficient_data"
    assert result["metrics_valid"] is False
    assert result["evaluation_metrics"] is None


def test_isolated_synthetic_training_and_evaluation():
    syn_df = _make_synthetic_history(num_students=5, attempts_per_student=4)
    # 5 students * (4 - 1) = 15 usable pairs >= 10
    result = train_from_dataframe(syn_df, save_artifacts=False)
    assert result["trained"] is True
    assert result["status"] == "trained"
    assert result["metrics_valid"] is True
    assert result["training_summary"]["usable_training_pairs"] == 15
    assert result["training_summary"]["split_strategy"] == "student_group_aware"
    metrics = result["evaluation_metrics"]
    assert set(metrics.keys()) == {"mae", "mse", "rmse", "r2"}
    assert metrics["mae"] >= 0
    assert metrics["rmse"] >= 0


def test_next_quiz_context_extraction():
    df = _make_synthetic_history(num_students=1, attempts_per_student=3)
    cleaned = clean_quiz_records(df)
    ctx = extract_next_quiz_context(cleaned)
    assert ctx["attempts_found"] == 3
    assert ctx["latest_accuracy"] == float(cleaned.iloc[-1]["accuracy"])
    assert ctx["previous_accuracy"] == float(cleaned.iloc[-2]["accuracy"])
    assert set(ctx["features"].keys()) == set(FEATURE_COLUMNS)
