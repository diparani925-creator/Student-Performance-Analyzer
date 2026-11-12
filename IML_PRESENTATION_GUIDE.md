# Student Performance Analyzer — IML Presentation & Viva Guide

A beginner-friendly technical guide and presentation handbook for the **Student Performance Analyzer with Intelligent Machine Learning (IML)**.

---

## 1. Project Introduction

**Student Performance Analyzer** is a full-stack, AI- and ML-powered web application designed to help students evaluate their academic proficiency, practice personalized quizzes, track their progress over time, and receive data-driven predictions of their future performance.

Unlike traditional static quiz websites, this system combines:
1. **Generative AI (Google Gemini API):** Creates dynamic, topic-specific quiz questions on demand tailored to the student's chosen course, subject, and difficulty level.
2. **Intelligent Machine Learning (Scikit-learn Linear Regression):** Uses a student's past quiz history to predict their next quiz score without data leakage.
3. **Interactive Analytics (Chart.js):** Displays topic-wise strengths, weaknesses, difficulty breakdowns, and historical improvement trends.

---

## 2. Problem Statement

In conventional academic assessments:
* **One-Size-Fits-All Testing:** Every student receives identical questions regardless of their current study stream or interest areas.
* **Lack of Predictive Insights:** Standard report cards only state what a student scored in the past; they cannot forecast how the student is likely to perform on their next attempt or show whether their trajectory is truly improving.
* **Disconnected Systems:** Learning platforms often separate testing, database logging, AI assistance, and predictive modeling into isolated tools.

**Solution:** A unified system that generates custom quizzes with generative AI, records detailed metrics (accuracy, question difficulties, time spent) into a relational database, and applies supervised Machine Learning to forecast future performance.

---

## 3. Project Objectives

1. Allow students to create a profile and customize assessments by subject, difficulty (`Easy`, `Medium`, `Hard`, `Mixed`), and question type (`MCQ`, `Numerical`).
2. Generate fresh, non-repetitive questions using Google Gemini API (with Hugging Face and offline fallback banks).
3. Record granular attempt metrics into a MySQL database:
   * Score, total questions, correct count, wrong count, and unanswered count.
   * Total time taken and average time spent per question.
   * Topic-wise accuracy and difficulty-level breakdown.
4. Build a dedicated Python ML microservice using Scikit-learn Linear Regression to forecast future quiz accuracy.
5. Provide a transparent dashboard with interactive charts, performance feedback, and honest ML status reporting.

---

## 4. Technologies Used

| Tier | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite | Fast, responsive single-page user interface |
| **Styling** | CSS3 & Custom Variables | Modern clean design with responsive cards and progress bars |
| **Visualizations** | Chart.js & React-Chartjs-2 | Doughnut, Bar, and Line charts for visual analytics |
| **Backend API** | Node.js & Express.js | API gateway, request validation, and routing |
| **Database** | MySQL (`mysql2` & `mysql-connector-python`) | Relational persistence for student profiles and quiz attempts |
| **Generative AI** | Google Gemini SDK (`gemini-2.5-flash`) | Dynamic AI question generation tailored to course levels |
| **Machine Learning** | Python 3, Scikit-learn, NumPy, Pandas | Leakage-free feature engineering, Linear Regression, and metrics |
| **ML Microservice** | Flask (Port `5001`) | Internal REST API serving health, prediction, and training endpoints |
| **Model Persistence** | Joblib | Serializing trained Scikit-learn pipelines to `.joblib` files |

---

## 5. System Architecture

```text
+-------------------------------------------------------------------------------+
|                             REACT FRONTEND (Vite)                             |
|                               (localhost:5173)                                |
|  - Student Profile Form (StudentForm.jsx)                                     |
|  - Quiz Configuration (QuizConfig.jsx)                                        |
|  - Timed Quiz Interface (QuizPage.jsx)                                        |
|  - Performance Dashboard & ML Prediction Card (ResultAnalysis.jsx)            |
+---------------------------------------+---------------------------------------+
                                        |  HTTP / JSON (Axios)
                                        v
+-------------------------------------------------------------------------------+
|                           NODE.JS + EXPRESS BACKEND                           |
|                               (localhost:5000)                                |
|  - /api/generate-questions  --> Calls Google Gemini API                       |
|  - /api/submit-quiz        --> Validates & saves attempts to MySQL            |
|  - /api/results/student    --> Retrieves student attempt history              |
|  - /api/ml/predict         --> Gateway proxy to Python ML service             |
|  - /api/ml/status          --> Health check for ML microservice               |
+-------------------+-----------------------------------+-----------------------+
                    |                                   |
         SQL Queries| (mysql2)               HTTP / JSON| (Axios)
                    v                                   v
+-----------------------------+       +-----------------------------------------+
|      MYSQL DATABASE         |       |         PYTHON FLASK ML SERVICE         |
|       (student_db)          |       |            (localhost:5001)             |
|  Table: results             |       |  - db_connector.py (MySQL fetch)        |
|  - attempt_id, name         |       |  - preprocessing.py (Feature extraction)|
|  - score, accuracy          |       |  - train.py (Linear Regression pipeline)|
|  - time_taken_sec           |       |  - app.py (/health, /predict, /train)   |
|  - avg_time_per_question    |       +-----------------------------------------+
|  - topicPerformance (JSON)  |
|  - difficultyPerformance    |
+-----------------------------+
```

---

## 6. How Linear Regression Works in This Project

Linear Regression is a fundamental **Supervised Learning** algorithm used to predict a continuous numerical value (the dependent variable $y$) based on one or more input features (independent variables $X_1, X_2, \dots, X_n$).

### The Mathematical Formula

$$y = \beta_0 + \beta_1 X_1 + \beta_2 X_2 + \beta_3 X_3 + \beta_4 X_4 + \epsilon$$

Where:
* **$y$ (Target):** Predicted Next Quiz Accuracy (0% to 100%).
* **$\beta_0$ (Intercept):** Base expected accuracy.
* **$\beta_1, \beta_2, \beta_3, \beta_4$ (Coefficients/Weights):** Learned impact of each feature.
* **$X_1$ (`prev_quiz_performance`):** Average accuracy across all prior completed quizzes.
* **$X_2$ (`prev_accuracy`):** Accuracy of the immediately preceding quiz.
* **$X_3$ (`attempt_count`):** Number of quizzes the student has completed so far.
* **$X_4$ (`prev_avg_time`):** Average time (in seconds) spent per question on the last quiz.
* **$\epsilon$:** Residual error.

### Why Linear Regression for Next-Quiz Prediction?
1. **Directly Interpretable:** Each coefficient reveals the exact effect of an input. For example, a positive coefficient on `prev_accuracy` shows that recent performance directly lifts the next prediction.
2. **Appropriate for Sequential Academic Growth:** Learning curve theory shows that short-term performance trends correlate linearly with cumulative study experience and recency.
3. **No Over-Fitting on Tabular Metrics:** Complex deep neural networks overfit when dealing with small numerical feature sets. Linear Regression provides reliable generalization.

---

## 7. MySQL Database Integration

The core student records are stored in table **`results`** inside database **`student_db`**:

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` | Unique record ID |
| `attempt_id` | `VARCHAR(100)` | Unique attempt identifier matching client and server |
| `name` | `VARCHAR(100)` | Student's full name |
| `currentCourse` | `VARCHAR(100)` | Current course level (e.g., `B.Tech`, `Class 10`) |
| `interestedCourse` | `VARCHAR(100)` | Interested field / career focus |
| `subject` | `VARCHAR(100)` | Exact subject tested |
| `quiz_difficulty` | `VARCHAR(50)` | Configured difficulty (`Easy`, `Medium`, `Hard`, `Mixed`) |
| `question_type` | `VARCHAR(50)` | Format of questions (`MCQ`, `Numerical`) |
| `score` | `INT` | Number of correct answers |
| `total_questions` | `INT` | Total number of questions in the quiz |
| `correct_answers` | `INT` | Total correct answers |
| `wrong_answers` | `INT` | Total wrong answers |
| `unanswered_count` | `INT` | Number of questions left blank |
| `accuracy` | `FLOAT` | Quiz score percentage `(score / total) * 100` |
| `time_taken_sec` | `INT` | Total seconds elapsed during the quiz |
| `avg_time_per_question`| `FLOAT` | Average seconds taken per question |
| `topicPerformance` | `TEXT` (JSON string) | Array of topic-wise accuracy breakdowns |
| `difficultyPerformance`| `TEXT` (JSON string) | Array of difficulty-wise accuracy breakdowns |
| `weak_areas` | `TEXT` (JSON string) | List of topics where accuracy fell below 40% |
| `feedback` | `TEXT` | Personalized feedback text |
| `created_at` | `TIMESTAMP` | Timestamp when the attempt was submitted |

---

## 8. Data Preprocessing & Anti-Leakage Design

Data preprocessing is handled in [`ml_service/preprocessing.py`](file:///c:/Users/Dipa%20Rani/Desktop/STUDENT%20PERFORMANCE%20ANALYZER/ml_service/preprocessing.py):

### 1. Cleaning & Type Casting
* Cleans student name, current course, and interested course by trimming whitespace and converting to lowercase for consistent student-profile grouping.
* Coerces numeric fields (`score`, `total_questions`, `accuracy`, `time_taken_sec`, `avg_time_per_question`) to valid numbers.
* Discards invalid records (e.g., non-positive question counts or accuracy values outside $[0, 100]$).

### 2. Missing Value Imputation
* If `avg_time_per_question` is missing (as in legacy records), it is derived from `time_taken_sec / total_questions`.
* During model training and inference, Scikit-learn's `SimpleImputer(strategy='median')` fills any remaining missing timing values using the training median. The imputer is fitted strictly on the training partition.

### 3. Strict Prevention of Data Leakage
**What is Data Leakage?** Data leakage occurs when future information (information from the quiz we are trying to predict) accidentally leaks into the input features used for training.

**How we prevent it:**
* To predict attempt $t$, we sort attempts chronologically by `created_at`.
* Features are computed strictly using attempts $0, 1, \dots, t-1$:
  * `prev_quiz_performance` = $\text{mean}(\text{accuracy}_{0 \dots t-1})$
  * `prev_accuracy` = $\text{accuracy}_{t-1}$
  * `attempt_count` = $t$
  * `prev_avg_time` = $\text{avg\_time}_{t-1}$
  * `target_accuracy` = $\text{accuracy}_t$
* The target quiz's own score, correct answers, or time are **never** included in its feature set.

---

## 9. Machine Learning Training Workflow

1. **Trigger:** Can be called via `POST http://localhost:5000/api/ml/train` or automatically at server startup.
2. **Fetch:** `db_connector.py` retrieves all student quiz records from MySQL.
3. **Dataset Construction:** `build_historical_training_dataset()` creates $(X, y)$ pairs from consecutive student attempts.
4. **Sufficiency Check:**
   * At least **10 sequential training pairs** are required across student groups.
   * If fewer than 10 pairs exist, the system **honestly gates** the model: it sets `trained: false`, `status: "insufficient_data"`, and stores an informative explanation without fabricating dummy metrics.
5. **Train / Test Split:**
   * Uses `GroupShuffleSplit` (student-group-aware) when sufficient student groups exist, ensuring that a student's attempts do not appear in both train and test sets.
   * Otherwise falls back to a strict chronological split (earliest 80% train, latest 20% test).
6. **Pipeline Execution:**
   ```python
   Pipeline([
       ("imputer", SimpleImputer(strategy="median")),
       ("scaler", StandardScaler()),
       ("regressor", LinearRegression())
   ])
   ```
7. **Evaluation:**
   * **MAE (Mean Absolute Error):** Average magnitude of prediction errors in percentage points.
   * **MSE (Mean Squared Error):** Average of squared prediction errors.
   * **RMSE (Root Mean Squared Error):** Error penalty in the original percentage scale ($\sqrt{\text{MSE}}$).
   * **$R^2$ Score (Coefficient of Determination):** Proportion of variance in quiz accuracy explained by the model.
8. **Persistence:** Saves the fitted pipeline as `linear_regression_model.joblib` and training details to `model_metadata.json`.

---

## 10. Prediction Workflow

When a student finishes a quiz or views the **Result Analysis** dashboard:

1. **Frontend Request:** `ResultAnalysis.jsx` sends the student profile (`studentName`, `currentCourse`, `interestedCourse`) to `POST /api/ml/predict`.
2. **Node.js Gateway:** Express forwards the request to Python Flask (`http://localhost:5001/predict`).
3. **Context Extraction:** Python queries MySQL for all attempts matching that student profile.
   * If no past attempts exist: Reports `"First Attempt"`.
   * If past attempts exist: Computes `prev_quiz_performance`, `prev_accuracy`, `attempt_count`, and `prev_avg_time`.
4. **Prediction Gate:**
   * If the model has completed real training: Loads `linear_regression_model.joblib`, runs `pipeline.predict()`, clips the result to $[0, 100]\%$, and returns the predicted score.
   * If the database has insufficient training data: Returns `prediction_available: false` with the exact count of database records and an honest explanation.
5. **Dashboard Rendering:**
   * React displays the **Predicted Next Quiz Accuracy**, **Previous Quiz Accuracy**, **Performance Trend** (`Improving` / `Declining` / `Stable`), and **ML Model Name**.
   * When trained, it reveals the real **Model Evaluation Metrics** (MAE, MSE, RMSE, $R^2$).
   * When data is insufficient, it displays a helpful amber **ML Status Notice**.

---

## 11. Advantages & Limitations

### Advantages
* **Authentic End-to-End IML:** Real connection from React $\rightarrow$ Express $\rightarrow$ Python Flask $\rightarrow$ Scikit-learn $\rightarrow$ MySQL.
* **Zero Fabrication:** Transparent reporting. Never shows fake 99% accuracy or synthetic training metrics in production.
* **Leakage-Free Feature Engineering:** Adheres to strict academic standards for time-series / sequential machine learning.
* **Fault Tolerant:** If the Python ML service is stopped, the Node.js backend handles the downtime gracefully with HTTP 503 error notices, leaving existing quiz and AI generator features completely operational.
* **AI + ML Synergy:** Combines Generative AI (Gemini for question authoring) with Discriminative ML (Linear Regression for score forecasting).

### Limitations
* **Cold-Start Data Requirement:** Linear Regression requires at least 10 historical transition pairs before it can train and evaluate. On a brand-new installation, predictions remain pending until students complete multiple quizzes.
* **Linear Assumption:** Linear Regression assumes an approximately linear relationship between past performance and future scores; extreme non-linear fluctuations (such as sudden guessing or external interruptions) are harder for a single linear model to capture.

---

## 12. Future Scope

1. **Non-Linear & Ensemble Models:** Benchmark Random Forest Regressor and Gradient Boosting (XGBoost) once hundreds of student attempts are logged.
2. **Unsupervised Student Persona Clustering:** Implement K-Means clustering ($k = 3$) to categorize learners into personas (e.g., *Fast Mastery*, *Steady Improver*, *Rushed Guesser*).
3. **Automated Difficulty Recommendation:** Automatically pre-set the next quiz's difficulty based on the ML predicted score (e.g., if predicted accuracy $> 85\%$, suggest `Hard`).
4. **Study Time Interval Feature:** Track the number of days or hours between quiz attempts as an additional feature (`days_between_attempts`) to model memory retention (Ebbinghaus forgetting curve).

---

## 13. Top 15 Viva Questions & Answers

### Q1: What is the main objective of your project?
> **Answer:** To provide an intelligent assessment platform that dynamically generates personalized quizzes using Google Gemini AI, records granular performance metrics in MySQL, and uses Scikit-learn Linear Regression to forecast a student's next quiz score based on their past learning trajectory.

### Q2: Why did you choose Linear Regression instead of a Deep Learning Neural Network?
> **Answer:** Linear Regression is well-suited for tabular numerical features (`prev_accuracy`, `prev_quiz_performance`, `attempt_count`, `prev_avg_time`). It is computationally lightweight, prevents overfitting on small-to-medium datasets, and provides direct mathematical interpretability through its learned weights and intercept.

### Q3: What is "Data Leakage" and how did you prevent it?
> **Answer:** Data leakage occurs when future information from the target variable is accidentally included in the input features during training, leading to unrealistically optimistic metrics. We prevent it by strictly ordering attempts chronologically; to predict attempt $t$, we compute features using **only** attempts $0$ through $t-1$.

### Q4: What features are used by your Machine Learning model?
> **Answer:** Four features:
> 1. `prev_quiz_performance`: Rolling average accuracy of all past quizzes.
> 2. `prev_accuracy`: Accuracy score of the latest completed quiz.
> 3. `attempt_count`: Number of prior attempts completed.
> 4. `prev_avg_time`: Average time spent per question on the latest quiz.

### Q5: What is the prediction target ($y$)?
> **Answer:** The continuous accuracy percentage (ranging from $0\%$ to $100\%$) on the student's *next* quiz attempt.

### Q6: How does the React frontend communicate with the Python ML service?
> **Answer:** Through the Node.js Express backend acting as an API Gateway. React sends a request to `/api/ml/predict` on port `5000`. Express validates the request and forwards it via Axios to the Python Flask microservice on port `5001`. Flask queries MySQL, extracts features, runs the Scikit-learn pipeline, and returns the prediction JSON.

### Q7: What evaluation metrics are used to measure the Linear Regression model?
> **Answer:** 
> * **MAE (Mean Absolute Error):** Measures average absolute prediction error in percentage points.
> * **MSE (Mean Squared Error):** Penalizes larger errors by squaring them.
> * **RMSE (Root Mean Squared Error):** The square root of MSE, returning the error to the original percentage scale.
> * **$R^2$ Score (Coefficient of Determination):** Explains how much of the variance in next-quiz scores is accounted for by the features.

### Q8: Why does the dashboard currently show "Insufficient Training Data"?
> **Answer:** Because our database currently contains 3 initial quiz attempts, giving 0 sequential transition pairs. Our ML training module enforces a strict academic threshold of at least 10 sequential quiz pairs across student profiles before training Linear Regression. This prevents fabricating fake metrics or overfitting on trivial sample sizes.

### Q9: How are missing values handled in the ML pipeline?
> **Answer:** We use Scikit-learn's `SimpleImputer(strategy='median')` inside a `Pipeline`. Missing average times are imputed using the median of the training partition, ensuring the imputer does not leak test-set information into training.

### Q10: Why did you use a Scikit-learn `Pipeline` instead of fitting individual steps?
> **Answer:** A `Pipeline` bundles the `SimpleImputer`, `StandardScaler`, and `LinearRegression` into a single reproducible object. When saving with `joblib`, the exact scaling factors (mean and variance) and imputation medians are saved together, preventing preprocessing discrepancies between training and live inference.

### Q11: How do you split your training and testing datasets?
> **Answer:** We use `GroupShuffleSplit` grouped by student name. This ensures all attempts from a single student stay entirely within either the training set or the test set, preventing the model from memorizing a specific student's behavior. If fewer student groups exist, we fall back to a chronological train/test split.

### Q12: What role does Google Gemini play compared to the Python ML module?
> **Answer:** They serve two different AI paradigms:
> * **Google Gemini (Generative AI):** Natural Language Generation. It crafts topic-specific, curriculum-aligned questions and explanations on the fly.
> * **Linear Regression (Predictive ML):** Supervised statistical learning. It analyzes numeric historical performance metrics to forecast future scores.

### Q13: What happens if the Python Flask server crashes or is turned off?
> **Answer:** The system features graceful degradation. The Node.js Express backend catches the network error and returns HTTP 503 with an informative notice. The student can still take quizzes, generate AI questions, view charts, and save their results without crashes.

### Q14: How is model persistence implemented?
> **Answer:** Using `joblib`. When the training threshold is satisfied, `train.py` exports the fitted pipeline to `ml_service/models/linear_regression_model.joblib`. The Flask API reloads this file into memory for instant sub-millisecond predictions without retraining on every API call.

### Q15: What new columns were added to MySQL in Phase 1 to support Machine Learning?
> **Answer:** Six structured columns were added using safe `ALTER TABLE` checks:
> 1. `time_taken_sec` (total quiz duration)
> 2. `avg_time_per_question` (pace metric)
> 3. `quiz_difficulty` (`Easy`, `Medium`, `Hard`, `Mixed`)
> 4. `question_type` (`MCQ`, `Numerical`)
> 5. `subject` (specific topic tested)
> 6. `unanswered_count` (number of skipped questions)

---

## 14. Step-by-Step Live Demonstration Script

Follow these exact steps during your college project presentation or viva demo:

### Step 1: Start the Entire System
Open PowerShell in the project directory and run:
```powershell
npm run dev
```
Point out to the examiners:
* **Terminal output confirms all 3 services running:**
  1. `[0]` Node.js Express on `http://localhost:5000` (Connected to MySQL)
  2. `[1]` React Vite on `http://localhost:5173`
  3. `[2]` Python Flask ML Service on `http://localhost:5001`

### Step 2: Open the Web Application
1. Open your browser and navigate to `http://localhost:5173/`.
2. Enter student details:
   * **Name:** `dipa rani`
   * **Current Course:** `B.Tech`
   * **Interested Field:** `Machine Learning`
3. Click **Start Quiz**.

### Step 3: Configure Quiz & Show AI Question Generation
1. In `/quiz-config`, show the customizable options:
   * **Subject:** `Machine Learning`
   * **Difficulty:** `Mixed`
   * **No. of Questions:** `5`
   * **Question Type:** `MCQ`
2. Click **Generate Quiz**.
3. Point out the loading spinner: *"The Node.js backend is calling Google Gemini `gemini-2.5-flash` to dynamically construct tailored Multiple Choice questions."*

### Step 4: Take the Quiz & Highlight Timing Metrics
1. Show the interactive timer at the top-right counting down.
2. Answer the questions. Intentionally leave 1 question unanswered.
3. Click **Submit Quiz**.
4. Show the browser confirmation modal: *"You have 1 unanswered questions. Are you sure you want to submit?"* Click **OK**.

### Step 5: Present the Performance Dashboard
On the `/result` page, guide the examiners through the sections:
1. **Summary Cards:** Score, Accuracy percentage, Correct, and Incorrect counts.
2. **Performance Status & Progress:** Improvement indicator showing `↑ improvement` or `↓ decrease` compared to the prior attempt.
3. **Personalized Feedback:** AI analysis categorizing topics into Strengths ($\ge 70\%$) and Weak Areas ($< 40\%$).
4. **4 Chart.js Visualizations:**
   * Topic Accuracy Bar Chart
   * Correct vs Incorrect Doughnut Chart
   * Performance by Difficulty Bar Chart
   * Multi-attempt Performance Trend Line Chart

### Step 6: Showcase the ML Next-Quiz Prediction Card
1. Scroll down to the **ML Next-Quiz Prediction** card.
2. Point out:
   * **Previous Quiz Accuracy:** Displays the accurate previous score.
   * **Performance Trend:** Shows learning direction (e.g., `Improving (+60%)`).
   * **ML Model Name:** `Linear Regression (Scikit-learn)`.
   * **ML Status Notice:** Explain the honesty guard to the examiners:
     > *"Our system connects to real MySQL records. Because this database currently has 3 records (fewer than the required 10 sequential training pairs), the system transparently explains that training data is accumulating rather than showing fabricated 99% accuracy figures."*

### Step 7: Demonstrate the Python ML Microservice Directly
Open a new browser tab or run curl to show the Python API:
* Navigate to `http://localhost:5001/health`
* Show the JSON response returning service health, training summary, and database records count.
* Explain: *"The Python Flask microservice handles feature extraction and Scikit-learn pipelines independently, keeping our architecture modular and microservice-oriented."*
