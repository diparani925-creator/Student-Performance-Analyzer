"""MySQL connection and data-fetching helpers for the ML service."""

import os
from pathlib import Path
import mysql.connector
import pandas as pd
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
LOCAL_ENV = BASE_DIR / ".env"
BACKEND_ENV = BASE_DIR.parent / "backend" / ".env"

if LOCAL_ENV.exists():
    load_dotenv(LOCAL_ENV, override=False)
if BACKEND_ENV.exists():
    load_dotenv(BACKEND_ENV, override=False)


RESULT_COLUMNS = [
    "id",
    "attempt_id",
    "name",
    "currentCourse",
    "interestedCourse",
    "subject",
    "quiz_difficulty",
    "question_type",
    "score",
    "total_questions",
    "correct_answers",
    "wrong_answers",
    "unanswered_count",
    "accuracy",
    "time_taken_sec",
    "avg_time_per_question",
    "created_at",
]


def get_db_connection():
    """Create a MySQL connection strictly from environment variables."""
    required_vars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        raise RuntimeError(
            f"Missing required MySQL environment variables: {', '.join(missing)}"
        )

    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT", "3306")),
    )


def fetch_all_results_df() -> pd.DataFrame:
    """Fetch all student quiz attempts ordered chronologically from MySQL."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        query = f"""
            SELECT {', '.join(RESULT_COLUMNS)}
            FROM results
            ORDER BY created_at ASC, id ASC
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()
        return pd.DataFrame(rows, columns=RESULT_COLUMNS)
    finally:
        conn.close()


def fetch_student_results_df(
    student_name: str, current_course: str, interested_course: str
) -> pd.DataFrame:
    """Fetch chronological quiz attempts for a specific student profile."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        query = f"""
            SELECT {', '.join(RESULT_COLUMNS)}
            FROM results
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
              AND LOWER(TRIM(currentCourse)) = LOWER(TRIM(%s))
              AND LOWER(TRIM(interestedCourse)) = LOWER(TRIM(%s))
            ORDER BY created_at ASC, id ASC
        """
        cursor.execute(query, (student_name, current_course, interested_course))
        rows = cursor.fetchall()
        cursor.close()
        return pd.DataFrame(rows, columns=RESULT_COLUMNS)
    finally:
        conn.close()

