"""Flask API microservice for Student Performance Analyzer ML predictions."""

import os
import pandas as pd
from flask import Flask, jsonify, request
import joblib

from db_connector import fetch_student_results_df
from preprocessing import FEATURE_COLUMNS, extract_next_quiz_context
from train import (
    MODEL_NAME,
    MODEL_PATH,
    load_saved_metadata,
    train_from_mysql,
)


app = Flask(__name__)


def _ensure_metadata():
    metadata = load_saved_metadata()
    if metadata is None:
        metadata = train_from_mysql(save_artifacts=True)
    return metadata


@app.get("/health")
def health():
    try:
        metadata = _ensure_metadata()
        return jsonify(
            {
                "service": "ml_service",
                "status": "ok",
                "model_name": metadata.get("model_name", MODEL_NAME),
                "model_status": metadata.get("status", "insufficient_data"),
                "trained": bool(metadata.get("trained", False)),
                "metrics_valid": bool(metadata.get("metrics_valid", False)),
                "evaluation_metrics": metadata.get("evaluation_metrics"),
                "training_summary": metadata.get("training_summary"),
                "message": metadata.get("message"),
            }
        )
    except Exception as exc:
        return (
            jsonify(
                {
                    "service": "ml_service",
                    "status": "error",
                    "model_name": MODEL_NAME,
                    "model_status": "error",
                    "trained": False,
                    "metrics_valid": False,
                    "evaluation_metrics": None,
                    "message": str(exc),
                }
            ),
            500,
        )


@app.post("/train")
def train_endpoint():
    try:
        metadata = train_from_mysql(save_artifacts=True)
        return jsonify({"success": True, **metadata})
    except Exception as exc:
        return (
            jsonify(
                {
                    "success": False,
                    "model_name": MODEL_NAME,
                    "status": "error",
                    "trained": False,
                    "metrics_valid": False,
                    "evaluation_metrics": None,
                    "message": f"Training failed: {exc}",
                }
            ),
            500,
        )


@app.post("/predict")
def predict_endpoint():
    payload = request.get_json(silent=True) or {}
    student_name = str(payload.get("studentName", "")).strip()
    current_course = str(payload.get("currentCourse", "")).strip()
    interested_course = str(payload.get("interestedCourse", "")).strip()

    if not student_name or not current_course or not interested_course:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "studentName, currentCourse, and interestedCourse are required.",
                }
            ),
            400,
        )

    try:
        student_df = fetch_student_results_df(
            student_name, current_course, interested_course
        )
        context = extract_next_quiz_context(student_df)
        metadata = _ensure_metadata()

        is_trained = bool(metadata.get("trained", False)) and MODEL_PATH.exists()
        metrics_valid = bool(metadata.get("metrics_valid", False)) and is_trained

        base_response = {
            "success": True,
            "model_name": metadata.get("model_name", MODEL_NAME),
            "model_status": metadata.get("status", "insufficient_data"),
            "trained": is_trained,
            "metrics_valid": metrics_valid,
            "evaluation_metrics": metadata.get("evaluation_metrics")
            if metrics_valid
            else None,
            "training_summary": metadata.get("training_summary"),
            "attempts_found": context["attempts_found"],
            "latest_accuracy": context["latest_accuracy"],
            "previous_accuracy": context["previous_accuracy"],
            "performance_trend": context["performance_trend"],
            "trend_delta": context["trend_delta"],
            "features_used": context["features"],
        }

        if context["attempts_found"] == 0 or context["features"] is None:
            return jsonify(
                {
                    **base_response,
                    "prediction_available": False,
                    "predicted_next_accuracy": None,
                    "message": (
                        "No completed quiz records found in MySQL for this student profile yet."
                    ),
                }
            )

        if not is_trained:
            return jsonify(
                {
                    **base_response,
                    "prediction_available": False,
                    "predicted_next_accuracy": None,
                    "message": metadata.get(
                        "message",
                        "Insufficient historical training data to generate ML predictions.",
                    ),
                }
            )

        pipeline = joblib.load(MODEL_PATH)
        features_row = pd.DataFrame([context["features"]], columns=FEATURE_COLUMNS)
        raw_pred = float(pipeline.predict(features_row)[0])
        clipped_pred = max(0.0, min(100.0, raw_pred))

        return jsonify(
            {
                **base_response,
                "prediction_available": True,
                "predicted_next_accuracy": round(clipped_pred, 2),
                "raw_predicted_accuracy": round(raw_pred, 2),
                "message": "Next quiz accuracy predicted using trained Linear Regression model.",
            }
        )
    except Exception as exc:
        return (
            jsonify(
                {
                    "success": False,
                    "model_name": MODEL_NAME,
                    "model_status": "error",
                    "trained": False,
                    "prediction_available": False,
                    "predicted_next_accuracy": None,
                    "metrics_valid": False,
                    "evaluation_metrics": None,
                    "message": f"Prediction failed: {exc}",
                }
            ),
            500,
        )


if __name__ == "__main__":
    port = int(os.getenv("ML_SERVICE_PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=False)
