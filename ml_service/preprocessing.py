"""Data cleaning and leakage-free historical feature engineering."""

from typing import Any, Dict, Optional
import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "prev_quiz_performance",
    "prev_accuracy",
    "attempt_count",
    "prev_avg_time",
]
TARGET_COLUMN = "target_accuracy"


def _normalize_text(series: pd.Series) -> pd.Series:
    return (
        series.fillna("")
        .astype(str)
        .str.strip()
        .str.lower()
    )


def clean_quiz_records(raw_df: pd.DataFrame) -> pd.DataFrame:
    """Clean raw MySQL quiz records and resolve derivable numeric values."""
    if raw_df is None or raw_df.empty:
        return pd.DataFrame()

    df = raw_df.copy()

    for text_col in ("name", "currentCourse", "interestedCourse"):
        if text_col not in df.columns:
            return pd.DataFrame()

    df["student_group"] = _normalize_text(df["name"])
    df["course_norm"] = _normalize_text(df["currentCourse"])
    df["field_norm"] = _normalize_text(df["interestedCourse"])

    # Drop records missing core profile identifiers
    valid_identity = (
        (df["student_group"] != "")
        & (df["course_norm"] != "")
        & (df["field_norm"] != "")
    )
    df = df.loc[valid_identity].copy()
    if df.empty:
        return df

    df["profile_key"] = (
        df["student_group"] + "||" + df["course_norm"] + "||" + df["field_norm"]
    )

    numeric_cols = [
        "id",
        "score",
        "total_questions",
        "correct_answers",
        "wrong_answers",
        "unanswered_count",
        "accuracy",
        "time_taken_sec",
        "avg_time_per_question",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        else:
            df[col] = np.nan

    # Require valid positive question counts
    df = df.loc[df["total_questions"].notna() & (df["total_questions"] > 0)].copy()
    if df.empty:
        return df

    # Derive accuracy if missing when correct_answers is valid
    missing_acc = df["accuracy"].isna() & df["correct_answers"].notna()
    df.loc[missing_acc, "accuracy"] = (
        df.loc[missing_acc, "correct_answers"]
        / df.loc[missing_acc, "total_questions"]
    ) * 100.0

    # Keep only valid target accuracies in [0, 100]
    df = df.loc[
        df["accuracy"].notna() & (df["accuracy"] >= 0.0) & (df["accuracy"] <= 100.0)
    ].copy()
    if df.empty:
        return df

    # Derive avg_time_per_question from time_taken_sec when missing (legacy rows stay NaN)
    missing_avg_time = (
        df["avg_time_per_question"].isna()
        & df["time_taken_sec"].notna()
        & (df["time_taken_sec"] >= 0)
    )
    df.loc[missing_avg_time, "avg_time_per_question"] = (
        df.loc[missing_avg_time, "time_taken_sec"]
        / df.loc[missing_avg_time, "total_questions"]
    )

    # Reject impossible negative timings by turning them into NaN for imputation
    df.loc[df["avg_time_per_question"] < 0, "avg_time_per_question"] = np.nan

    if "created_at" in df.columns:
        df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    else:
        df["created_at"] = pd.NaT

    df = df.sort_values(
        by=["profile_key", "created_at", "id"],
        ascending=[True, True, True],
        na_position="last",
    ).reset_index(drop=True)

    return df


def build_historical_training_dataset(raw_df: pd.DataFrame) -> pd.DataFrame:
    """
    Create supervised (X, y) pairs using ONLY attempts completed BEFORE each quiz.

    For attempt t (t >= 1 in 0-based index):
      - prev_quiz_performance: mean accuracy across attempts 0 .. t-1
      - prev_accuracy: accuracy of attempt t-1
      - attempt_count: number of prior attempts completed (t)
      - prev_avg_time: avg_time_per_question of attempt t-1 (may be NaN)
      - target_accuracy: accuracy of attempt t
    """
    cleaned = clean_quiz_records(raw_df)
    columns = FEATURE_COLUMNS + [
        TARGET_COLUMN,
        "student_group",
        "profile_key",
        "target_created_at",
        "target_attempt_id",
    ]
    if cleaned.empty:
        return pd.DataFrame(columns=columns)

    rows = []
    for profile_key, group in cleaned.groupby("profile_key", sort=False):
        group = group.reset_index(drop=True)
        if len(group) < 2:
            continue

        accuracies = group["accuracy"].astype(float).tolist()
        avg_times = group["avg_time_per_question"].tolist()
        student_group = str(group.loc[0, "student_group"])

        for idx in range(1, len(group)):
            prior_accuracies = accuracies[:idx]
            prev_accuracy = float(accuracies[idx - 1])
            prev_quiz_performance = float(np.mean(prior_accuracies))
            prev_avg_time_raw = avg_times[idx - 1]
            prev_avg_time = (
                float(prev_avg_time_raw) if pd.notna(prev_avg_time_raw) else np.nan
            )

            rows.append(
                {
                    "prev_quiz_performance": round(prev_quiz_performance, 4),
                    "prev_accuracy": round(prev_accuracy, 4),
                    "attempt_count": int(idx),
                    "prev_avg_time": prev_avg_time,
                    TARGET_COLUMN: float(accuracies[idx]),
                    "student_group": student_group,
                    "profile_key": profile_key,
                    "target_created_at": group.loc[idx, "created_at"],
                    "target_attempt_id": group.loc[idx, "attempt_id"]
                    if "attempt_id" in group.columns
                    else None,
                }
            )

    if not rows:
        return pd.DataFrame(columns=columns)

    result_df = pd.DataFrame(rows)
    return result_df.sort_values(
        by=["target_created_at", "profile_key", "attempt_count"],
        ascending=[True, True, True],
        na_position="last",
    ).reset_index(drop=True)


def extract_next_quiz_context(student_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Extract inference features from all completed attempts to predict the NEXT quiz.
    Also summarizes latest/previous accuracy and performance trend for display.
    """
    cleaned = clean_quiz_records(student_df)
    if cleaned.empty:
        return {
            "attempts_found": 0,
            "latest_accuracy": None,
            "previous_accuracy": None,
            "performance_trend": "No History",
            "trend_delta": None,
            "features": None,
        }

    attempts_found = len(cleaned)
    latest_accuracy = float(cleaned.iloc[-1]["accuracy"])
    previous_accuracy: Optional[float] = (
        float(cleaned.iloc[-2]["accuracy"]) if attempts_found >= 2 else None
    )

    if previous_accuracy is None:
        trend_label = "First Attempt"
        trend_delta = None
    else:
        trend_delta = round(latest_accuracy - previous_accuracy, 2)
        if trend_delta > 0:
            trend_label = f"Improving (+{trend_delta:.0f}%)"
        elif trend_delta < 0:
            trend_label = f"Declining ({trend_delta:.0f}%)"
        else:
            trend_label = "Stable (0%)"

    prev_avg_time_raw = cleaned.iloc[-1]["avg_time_per_question"]
    prev_avg_time = (
        float(prev_avg_time_raw) if pd.notna(prev_avg_time_raw) else None
    )

    features = {
        "prev_quiz_performance": round(float(cleaned["accuracy"].mean()), 4),
        "prev_accuracy": round(latest_accuracy, 4),
        "attempt_count": int(attempts_found),
        "prev_avg_time": prev_avg_time,
    }

    return {
        "attempts_found": attempts_found,
        "latest_accuracy": round(latest_accuracy, 2),
        "previous_accuracy": round(previous_accuracy, 2)
        if previous_accuracy is not None
        else None,
        "performance_trend": trend_label,
        "trend_delta": trend_delta,
        "features": features,
    }

