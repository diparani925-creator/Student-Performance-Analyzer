const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const db = require("./db");
const axios = require("axios");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || "http://localhost:5001").replace(/\/+$/, "");

app.use(cors());
app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithFallback(prompt) {
  const maxRetries = 2;
  let attempts = 0;
  
  while (attempts <= maxRetries) {
    try {
      console.log(`🤖 Using Gemini (Attempt ${attempts + 1})`);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        }
      });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (error) {
      attempts++;
      console.error(`❌ Gemini Attempt ${attempts} Failed:`, error.message);
      if (attempts <= maxRetries) {
        console.log(`⏳ Waiting 2 seconds before retry...`);
        await delay(2000);
      }
    }
  }

  console.log("🔄 Switching to Hugging Face");
  try {
    const hfPrompt = prompt + "\n\nProvide the response strictly as valid JSON without any markdown formatting or extra text.";
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/google/flan-t5-large",
      { inputs: hfPrompt },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    let aiResponse = response.data[0]?.generated_text;
    if (aiResponse) {
      const jsonMatch = aiResponse.match(/\[.*\]|\{.*\}/s);
      if (jsonMatch) {
         aiResponse = jsonMatch[0];
      }
      return JSON.parse(aiResponse);
    }
    throw new Error("Empty response from Hugging Face");
  } catch (hfError) {
    console.error("❌ Hugging Face Fallback Failed:", hfError.message);
    throw new Error("Both AI models failed.");
  }
}

/* ROOT ROUTE */
app.get("/", (req, res) => {
  res.send("✅ Backend server is running successfully!");
});

/* JWT VERIFICATION MIDDLEWARE */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(403).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET || "default_secret", (err, decoded) => {
    if (err) return res.status(401).json({ error: "Unauthorized: Invalid token" });
    req.user = decoded;
    next();
  });
};

/* USER LOGIN API */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const query = "SELECT * FROM users WHERE email = ?";
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (results.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      process.env.JWT_SECRET || "default_secret", 
      { expiresIn: "2h" }
    );
    res.json({ success: true, message: "✅ Login successful", token, role: user.role, email: user.email, name: user.name || "User" });
  });
});

/* USER REGISTRATION API */
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'student')";
    
    db.query(query, [name, email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ error: "Email already exists" });
        }
        console.error("❌ DB Error:", err);
        return res.status(500).json({ error: "Failed to register user" });
      }
      res.json({ success: true, message: "✅ Registration successful" });
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* GET RESULTS API (ADMIN ONLY) */
app.get("/api/results", verifyToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }

  const query = "SELECT * FROM results ORDER BY created_at DESC";
  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Failed to fetch results" });
    }
    res.json({ success: true, results });
  });
});

/* FETCH COURSES */
app.get("/api/courses", (req, res) => {
  db.query("SELECT * FROM courses", (err, results) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Failed to fetch courses" });
    }
    res.json({ success: true, courses: results });
  });
});

/* ADD COURSE (ADMIN) */
app.post("/api/courses", verifyToken, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  const { name } = req.body;
  db.query("INSERT INTO courses (name) VALUES (?)", [name], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to add course" });
    res.json({ success: true, message: "Course added successfully" });
  });
});

/* FETCH SUBJECTS BY COURSE ID */
app.get("/api/subjects/:courseId", (req, res) => {
  const { courseId } = req.params;
  // If it's not a number, we might need to find course by name. For now assume ID.
  // Wait, the frontend passes course.id as value for select.
  db.query("SELECT * FROM subjects WHERE course_id = ?", [courseId], (err, results) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Failed to fetch subjects" });
    }
    res.json({ success: true, subjects: results });
  });
});

/* ADD SUBJECT (ADMIN) */
app.post("/api/subjects", verifyToken, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  const { courseId, name } = req.body;
  db.query("INSERT INTO subjects (course_id, name) VALUES (?, ?)", [courseId, name], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to add subject" });
    res.json({ success: true, message: "Subject added successfully" });
  });
});

/* GET ALL ADMIN QUESTIONS */
app.get("/api/admin/questions", verifyToken, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  db.query("SELECT * FROM questions", (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch questions" });
    res.json({ success: true, questions: results });
  });
});

/* ADD ADMIN QUESTION */
app.post("/api/admin/questions", verifyToken, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  const { course, subject, text, options, answer, difficulty, type } = req.body;
  db.query(
    "INSERT INTO questions (course, subject, text, options, answer, difficulty, type) VALUES (?, ?, ?, ?, ?, ?, ?)", 
    [course, subject, text, JSON.stringify(options), answer, difficulty, type], 
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to add question" });
      res.json({ success: true, message: "Question added successfully" });
    }
  );
});

/* DELETE ADMIN QUESTION */
app.delete("/api/admin/questions/:id", verifyToken, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  db.query("DELETE FROM questions WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to delete question" });
    res.json({ success: true, message: "Question deleted successfully" });
  });
});

/* ✅ AI QUESTION GENERATOR (FIXED) */
app.post("/api/questions", async (req, res) => {
  const { name, course, subject, difficulty, count, type } = req.body;

  console.log("📩 Request received:", req.body);

  if (!course || !subject || !difficulty || !count || !type) {
    return res.status(400).json({ error: "All quiz configuration fields are required" });
  }

  try {
    const prompt = `Generate exactly ${count} ${difficulty} level ${type} questions for ${subject} under ${course}.

Instructions:
- Adapt difficulty based on course:
  • Class 1–5 → very basic and simple
  • Class 6–8 → moderate basics
  • Class 9–12 → school-level conceptual questions
  • Graduation (BSc, BCom, BA, etc.) → conceptual + analytical questions
  • JEE / NEET → competitive exam level (high difficulty, problem-solving)

- Questions must be:
  • Clear and unambiguous
  • Relevant to the subject
  • Appropriate for the selected course level
  • Non-repetitive

- If question type is MCQ:
  • Provide exactly 4 options (A, B, C, D)
  • Only one correct answer

- If question type is Numerical:
  • Provide a direct numeric answer

Output format (STRICT JSON):
[
  {
    "question": "string",
    "options": ["A", "B", "C", "D"], 
    "answer": "correct option or value",
    "explanation": "step-by-step explanation"
  }
]

Rules:
- Do not include any extra text outside JSON
- Ensure valid JSON format
- Avoid duplicate questions
- Keep explanations simple and clear`;

    const parsedData = await generateWithFallback(prompt);

    console.log("🤖 AI Response generated with fallback logic");

    res.json({
      success: true,
      questions: parsedData
    });

  } catch (error) {
    console.error("❌ AI Error:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to generate questions"
    });
  }
});

/* SAVE RESULT API */
app.post("/api/evaluate", (req, res) => {
  const { name, course, subject, score, total_questions, correct_answers, wrong_answers, weak_areas, feedback } = req.body;

  const query = `
    INSERT INTO results 
    (name, currentCourse, interestedCourse, score, total_questions, correct_answers, wrong_answers, weak_areas, feedback) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // We are storing 'course' into 'currentCourse' and 'subject' into 'interestedCourse' for backward compatibility
  db.query(query, [name, course, subject, score, total_questions, correct_answers, wrong_answers, weak_areas, feedback], (err, result) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Failed to save result" });
    }

    res.json({
      success: true,
      message: "✅ Result saved successfully"
    });
  });
});

/* ✅ APTITUDE / CAREER ASSESSMENT GENERATOR */
app.post("/api/generate-aptitude", async (req, res) => {
  const { name, currentCourse, interestedCourse } = req.body;

  try {
    const prompt = `
You are an AI-powered Student Performance Analyzer.

Student Name: ${name || 'Unknown'}
Current Course: ${currentCourse || 'Unknown'}
Interested Course: ${interestedCourse || 'Unknown'}

Task:
1. Generate 5 aptitude-style questions related to the Interested Course.
2. Each question should test logical reasoning, subject knowledge, and career aptitude.
3. Keep questions short, clear, and suitable for students.
4. Provide diverse answer formats:
   - True/False
   - Numeric (e.g., "Enter a number")
   - Multiple Choice (e.g., ["Option A","Option B","Option C","Option D"])
5. Return output strictly in JSON format:

[
  {"question": "Is AI used in healthcare?", "type": "true_false", "options": ["True","False"]},
  {"question": "How many bits are in 1 byte?", "type": "numeric", "answer": "8"},
  {"question": "Which algorithm is used for sorting?", "type": "multiple_choice", "options": ["Bubble Sort","Binary Search","DFS","BFS"], "answer": "Bubble Sort"},
  {"question": "AI can learn patterns from data.", "type": "true_false", "options": ["True","False"]},
  {"question": "Select the correct ML model for classification.", "type": "multiple_choice", "options": ["Linear Regression","Decision Tree","K-Means","PCA"], "answer": "Decision Tree"}
]
`;

    const parsedData = await generateWithFallback(prompt);
    res.json({ success: true, questions: parsedData });
  } catch (err) {
    console.error("❌ AI Error:", err.message);
    res.status(500).json({ success: false, error: "Failed to generate aptitude questions" });
  }
});

/* ✅ REACT GRADUATION: GENERATE QUESTIONS */
app.post("/api/generate-questions", async (req, res) => {
  const { subject, difficulty, count, type, currentCourse, interestedCourse } = req.body;
  if (!subject || !difficulty || !count || !type) return res.status(400).json({ error: "Missing fields" });

  try {
    let difficultyPrompt = `${difficulty} level`;
    if (difficulty === 'Mixed') {
      if (count === 10) {
        difficultyPrompt = 'a mix of 3 Easy, 4 Medium, and 3 Hard level';
      } else if (count === 5) {
        difficultyPrompt = 'a mix of 2 Easy, 2 Medium, and 1 Hard level';
      } else {
        const easyCount = Math.round(count * 0.3) || 1;
        const hardCount = Math.round(count * 0.3) || 1;
        const mediumCount = count - easyCount - hardCount;
        difficultyPrompt = `a mix of ${easyCount} Easy, ${mediumCount} Medium, and ${hardCount} Hard level`;
      }
    }

    const prompt = `Generate exactly ${count} ${difficultyPrompt} ${type} questions for ${subject}.
The student is currently studying: ${currentCourse || 'Graduation'}.
Their interested course / goal is: ${interestedCourse || 'Graduation'}.
Ensure the questions are highly relevant, concept-based, and practical for their current level and goals.
Each question object in the JSON array must include a "difficulty" field containing the difficulty ("Easy", "Medium", or "Hard") of that specific question.
If question type is MCQ: Provide 4 options and the correct answer.
If question type is Numerical: Provide a direct numeric answer.

Output format (STRICT JSON):
[
  {
    "question": "string",
    "options": ["A", "B", "C", "D"], 
    "correctAnswer": "correct option or value",
    "explanation": "detailed practical explanation",
    "topic": "specific subtopic (e.g., Recursion, Joins, Calculus)",
    "difficulty": "Easy" | "Medium" | "Hard"
  }
]`;

    const parsedData = await generateWithFallback(prompt);
    res.json({ success: true, questions: parsedData });
  } catch (err) {
    console.error("❌ AI Error:", err.message);
    res.status(500).json({ success: false, error: "Failed to generate questions", details: err.message });
  }
});

/* ✅ REACT GRADUATION: ANALYZE PERFORMANCE */
app.post("/api/analyze-performance", async (req, res) => {
  const { wrongTopics, subject, currentCourse, interestedCourse } = req.body;
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
    const prompt = `A student currently studying ${currentCourse || 'Graduation'} aiming for ${interestedCourse || 'Graduation'} took a test in ${subject}. 
They got questions wrong in these topics: ${wrongTopics.join(", ") || "None"}.

Based on this, generate a personalized performance analysis.
Output format (STRICT JSON):
{
  "weakTopics": ["topic1", "topic2"],
  "strengths": ["topic1", "topic2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "studyPlan": "A practical paragraph detailing what to study and how."
}`;

    const result = await model.generateContent(prompt);
    const analysis = JSON.parse(result.response.text());
    res.json({ success: true, analysis });
  } catch (err) {
    console.error("❌ AI Analysis Error:", err.message);
    res.status(500).json({ success: false, error: "Failed to analyze performance" });
  }
});

/* ✅ REACT GRADUATION: SUBMIT QUIZ */
app.post("/api/submit-quiz", (req, res) => {
  const {
    attempt_id,
    studentName,
    currentCourse,
    interestedCourse,
    subject,
    quiz_difficulty,
    question_type,
    score,
    total,
    correct_answers,
    wrong_answers,
    unanswered_count,
    accuracy,
    time_taken_sec,
    avg_time_per_question,
    topicPerformance,
    difficultyPerformance,
    analysis
  } = req.body || {};

  // Validate required & structured student performance inputs
  const cleanName = typeof studentName === "string" ? studentName.trim().slice(0, 100) : "";
  if (!cleanName) {
    return res.status(400).json({ success: false, error: "studentName is required" });
  }

  const totalQuestions = Number(total);
  if (!Number.isInteger(totalQuestions) || totalQuestions < 1) {
    return res.status(400).json({ success: false, error: "total must be a positive integer" });
  }

  const numericScore = Number(score);
  if (!Number.isInteger(numericScore) || numericScore < 0 || numericScore > totalQuestions) {
    return res.status(400).json({ success: false, error: "score must be an integer between 0 and total" });
  }

  const correctCount = correct_answers !== undefined && correct_answers !== null
    ? Number(correct_answers)
    : numericScore;
  if (!Number.isInteger(correctCount) || correctCount < 0 || correctCount > totalQuestions) {
    return res.status(400).json({ success: false, error: "correct_answers must be an integer between 0 and total" });
  }

  const wrongCount = wrong_answers !== undefined && wrong_answers !== null
    ? Number(wrong_answers)
    : (totalQuestions - correctCount);
  if (!Number.isInteger(wrongCount) || wrongCount < 0 || wrongCount > totalQuestions) {
    return res.status(400).json({ success: false, error: "wrong_answers must be an integer between 0 and total" });
  }

  const unansweredCount = unanswered_count !== undefined && unanswered_count !== null
    ? Number(unanswered_count)
    : 0;
  if (!Number.isInteger(unansweredCount) || unansweredCount < 0 || unansweredCount > totalQuestions) {
    return res.status(400).json({ success: false, error: "unanswered_count must be an integer between 0 and total" });
  }

  const numericAccuracy = accuracy !== undefined && accuracy !== null
    ? Number(accuracy)
    : (correctCount / totalQuestions) * 100;
  if (!Number.isFinite(numericAccuracy) || numericAccuracy < 0 || numericAccuracy > 100) {
    return res.status(400).json({ success: false, error: "accuracy must be a number between 0 and 100" });
  }

  const rawTimeTaken = time_taken_sec !== undefined && time_taken_sec !== null
    ? Number(time_taken_sec)
    : 0;
  if (!Number.isFinite(rawTimeTaken) || rawTimeTaken < 0) {
    return res.status(400).json({ success: false, error: "time_taken_sec must be a non-negative number" });
  }
  const timeTakenSec = Math.round(rawTimeTaken);

  const avgTimePerQuestion = avg_time_per_question !== undefined && avg_time_per_question !== null
    ? Number(avg_time_per_question)
    : Number((timeTakenSec / totalQuestions).toFixed(2));
  if (!Number.isFinite(avgTimePerQuestion) || avgTimePerQuestion < 0) {
    return res.status(400).json({ success: false, error: "avg_time_per_question must be a non-negative number" });
  }

  const allowedDifficulties = { easy: "Easy", medium: "Medium", hard: "Hard", mixed: "Mixed" };
  let cleanDifficulty = "Mixed";
  if (quiz_difficulty !== undefined && quiz_difficulty !== null && String(quiz_difficulty).trim() !== "") {
    const normalizedDiff = allowedDifficulties[String(quiz_difficulty).trim().toLowerCase()];
    if (!normalizedDiff) {
      return res.status(400).json({ success: false, error: "Invalid quiz_difficulty. Allowed: Easy, Medium, Hard, Mixed" });
    }
    cleanDifficulty = normalizedDiff;
  }

  const allowedTypes = { mcq: "MCQ", numerical: "Numerical" };
  let cleanType = "MCQ";
  if (question_type !== undefined && question_type !== null && String(question_type).trim() !== "") {
    const normalizedType = allowedTypes[String(question_type).trim().toLowerCase()];
    if (!normalizedType) {
      return res.status(400).json({ success: false, error: "Invalid question_type. Allowed: MCQ, Numerical" });
    }
    cleanType = normalizedType;
  }

  const cleanCurrentCourse = (typeof currentCourse === "string" && currentCourse.trim())
    ? currentCourse.trim().slice(0, 100)
    : "Graduation";
  const cleanInterestedCourse = (typeof interestedCourse === "string" && interestedCourse.trim())
    ? interestedCourse.trim().slice(0, 100)
    : "Graduation";
  const cleanSubject = (typeof subject === "string" && subject.trim())
    ? subject.trim().slice(0, 100)
    : cleanInterestedCourse;

  const finalAttemptId = (typeof attempt_id === "string" && attempt_id.trim())
    ? attempt_id.trim().slice(0, 100)
    : `attempt_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const serializeJsonField = (val, fallback = "[]") => {
    if (val === undefined || val === null) return fallback;
    if (typeof val === "object") return JSON.stringify(val);
    if (typeof val === "string") {
      try {
        JSON.parse(val);
        return val;
      } catch (e) {
        return fallback;
      }
    }
    return fallback;
  };

  const topicPerfStr = serializeJsonField(topicPerformance, "[]");
  const diffPerfStr = serializeJsonField(difficultyPerformance, "[]");
  const weakAreasSource = analysis?.weakTopics ?? req.body?.weakAreas;
  const weakAreasStr = serializeJsonField(weakAreasSource, "[]");
  const feedbackStr = typeof analysis?.studyPlan === "string"
    ? analysis.studyPlan
    : (typeof req.body?.feedback === "string" ? req.body.feedback : "");

  // Prevent duplicate inserts for the same attempt_id
  db.query("SELECT id, attempt_id FROM results WHERE attempt_id = ? LIMIT 1", [finalAttemptId], (checkErr, existingRows) => {
    if (checkErr) {
      console.error("❌ DB Error:", checkErr);
      return res.status(500).json({ error: "Failed to verify attempt_id" });
    }

    if (existingRows.length > 0) {
      return res.json({
        success: true,
        message: "Result already saved",
        id: existingRows[0].id,
        attempt_id: existingRows[0].attempt_id,
        duplicate: true
      });
    }

    const insertQuery = `
      INSERT INTO results
      (attempt_id, name, currentCourse, interestedCourse, subject, quiz_difficulty, question_type, score, total_questions, correct_answers, wrong_answers, unanswered_count, accuracy, time_taken_sec, avg_time_per_question, topicPerformance, difficultyPerformance, weak_areas, feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertQuery,
      [
        finalAttemptId,
        cleanName,
        cleanCurrentCourse,
        cleanInterestedCourse,
        cleanSubject,
        cleanDifficulty,
        cleanType,
        numericScore,
        totalQuestions,
        correctCount,
        wrongCount,
        unansweredCount,
        Number(numericAccuracy.toFixed(2)),
        timeTakenSec,
        Number(avgTimePerQuestion.toFixed(2)),
        topicPerfStr,
        diffPerfStr,
        weakAreasStr,
        feedbackStr
      ],
      (err, result) => {
        if (err) {
          console.error("❌ DB Error:", err);
          return res.status(500).json({ error: "Failed to save result" });
        }
        res.json({
          success: true,
          message: "Result saved",
          id: result.insertId,
          attempt_id: finalAttemptId
        });
      }
    );
  });
});

/* ✅ FETCH STUDENT RESULTS HISTORY */
app.get("/api/results/student", (req, res) => {
  const { name, currentCourse, interestedCourse } = req.query;

  if (!name || !currentCourse || !interestedCourse) {
    return res.status(400).json({ error: "Missing student name, current course, or interested course parameters" });
  }

  const query = `
    SELECT * FROM results 
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
      AND LOWER(TRIM(currentCourse)) = LOWER(TRIM(?))
      AND LOWER(TRIM(interestedCourse)) = LOWER(TRIM(?))
    ORDER BY created_at ASC
  `;

  db.query(query, [name, currentCourse, interestedCourse], (err, results) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Failed to fetch student history" });
    }

    const formatted = results.map((row) => {
      let topicPerf = [];
      let diffPerf = [];
      try {
        topicPerf = row.topicPerformance ? JSON.parse(row.topicPerformance) : [];
      } catch (e) {
        topicPerf = [];
      }
      try {
        diffPerf = row.difficultyPerformance ? JSON.parse(row.difficultyPerformance) : [];
      } catch (e) {
        diffPerf = [];
      }

      let weakAreas = [];
      try {
        weakAreas = row.weak_areas ? JSON.parse(row.weak_areas) : [];
      } catch (e) {
        weakAreas = [];
      }

      return {
        id: row.attempt_id || `db_${row.id}`,
        attempt_id: row.attempt_id || `db_${row.id}`,
        date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        dateTime: new Date(row.created_at).toLocaleString('en-US'),
        studentName: row.name,
        currentCourse: row.currentCourse,
        interestedCourse: row.interestedCourse,
        subject: row.subject || row.interestedCourse || null,
        quizDifficulty: row.quiz_difficulty || null,
        questionType: row.question_type || null,
        totalQuestions: row.total_questions,
        correctAnswers: row.correct_answers,
        incorrectAnswers: row.wrong_answers,
        unansweredCount: row.unanswered_count,
        score: row.score,
        accuracy: row.accuracy,
        timeTakenSec: row.time_taken_sec,
        avgTimePerQuestion: row.avg_time_per_question,
        topicPerformance: topicPerf,
        difficultyPerformance: diffPerf,
        weakAreas: weakAreas,
        feedback: row.feedback
      };
    });

    res.json({ success: true, results: formatted });
  });
});

/* ✅ CLEAR STUDENT RESULTS HISTORY */
app.delete("/api/results/student", (req, res) => {
  const { name, currentCourse, interestedCourse } = req.query;

  if (!name || !currentCourse || !interestedCourse) {
    return res.status(400).json({ error: "Missing student name, current course, or interested course parameters" });
  }

  const query = `
    DELETE FROM results 
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
      AND LOWER(TRIM(currentCourse)) = LOWER(TRIM(?))
      AND LOWER(TRIM(interestedCourse)) = LOWER(TRIM(?))
  `;

  db.query(query, [name, currentCourse, interestedCourse], (err, result) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Failed to clear student history" });
    }
    res.json({ success: true, message: "Student history cleared successfully" });
  });
});

/* ✅ ML SERVICE INTEGRATION: STATUS, TRAINING & PREDICTION */
const handleMlPredict = async (req, res) => {
  const source = req.method === "GET" ? req.query : req.body || {};
  const studentName = String(source.studentName || source.name || "").trim();
  const currentCourse = String(source.currentCourse || "").trim();
  const interestedCourse = String(source.interestedCourse || "").trim();

  if (!studentName || !currentCourse || !interestedCourse) {
    return res.status(400).json({
      success: false,
      error: "studentName, currentCourse, and interestedCourse are required"
    });
  }

  try {
    const mlResponse = await axios.post(
      `${ML_SERVICE_URL}/predict`,
      { studentName, currentCourse, interestedCourse },
      { timeout: 8000 }
    );
    return res.status(200).json(mlResponse.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        model_name: err.response.data?.model_name || "Linear Regression (Scikit-learn)",
        model_status: err.response.data?.model_status || "error",
        trained: false,
        prediction_available: false,
        predicted_next_accuracy: null,
        metrics_valid: false,
        evaluation_metrics: null,
        message: err.response.data?.error || err.response.data?.message || "ML prediction failed"
      });
    }

    console.error("❌ ML Service Connection Error:", err.message);
    return res.status(503).json({
      success: false,
      model_name: "Linear Regression (Scikit-learn)",
      model_status: "service_unavailable",
      trained: false,
      prediction_available: false,
      predicted_next_accuracy: null,
      metrics_valid: false,
      evaluation_metrics: null,
      message: "Python ML service is currently unavailable. Please start ml_service/app.py."
    });
  }
};

app.post("/api/ml/predict", handleMlPredict);
app.get("/api/ml/predict", handleMlPredict);

app.post("/api/ml/train", async (req, res) => {
  try {
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/train`, {}, { timeout: 15000 });
    return res.status(200).json(mlResponse.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    console.error("❌ ML Train Connection Error:", err.message);
    return res.status(503).json({
      success: false,
      model_name: "Linear Regression (Scikit-learn)",
      status: "service_unavailable",
      trained: false,
      metrics_valid: false,
      evaluation_metrics: null,
      message: "Python ML service is currently unavailable. Please start ml_service/app.py."
    });
  }
});

app.get("/api/ml/status", async (req, res) => {
  try {
    const mlResponse = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });
    return res.status(200).json(mlResponse.data);
  } catch (err) {
    console.error("❌ ML Status Connection Error:", err.message);
    return res.status(503).json({
      service: "ml_service",
      status: "service_unavailable",
      model_name: "Linear Regression (Scikit-learn)",
      model_status: "service_unavailable",
      trained: false,
      metrics_valid: false,
      evaluation_metrics: null,
      message: "Python ML service is currently unavailable."
    });
  }
});

/* SERVER START */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
