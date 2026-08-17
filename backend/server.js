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
    score, 
    total, 
    correct_answers, 
    wrong_answers, 
    accuracy, 
    topicPerformance, 
    difficultyPerformance, 
    analysis 
  } = req.body;
  
  const query = `
    INSERT INTO results 
    (attempt_id, name, currentCourse, interestedCourse, score, total_questions, correct_answers, wrong_answers, accuracy, topicPerformance, difficultyPerformance, weak_areas, feedback) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const topicPerfStr = typeof topicPerformance === 'object' ? JSON.stringify(topicPerformance) : (topicPerformance || '[]');
  const diffPerfStr = typeof difficultyPerformance === 'object' ? JSON.stringify(difficultyPerformance) : (difficultyPerformance || '[]');
  const weakAreasStr = typeof analysis?.weakTopics === 'object' ? JSON.stringify(analysis.weakTopics) : JSON.stringify(req.body.weakAreas || []);
  const feedbackStr = analysis?.studyPlan || req.body.feedback || "";

  db.query(
    query, 
    [
      attempt_id || `attempt_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      studentName, 
      currentCourse || "Graduation", 
      interestedCourse || "Graduation", 
      score, 
      total, 
      correct_answers || 0, 
      wrong_answers || 0, 
      accuracy || 0, 
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
      res.json({ success: true, message: "Result saved", id: result.insertId });
    }
  );
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
        date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        dateTime: new Date(row.created_at).toLocaleString('en-US'),
        studentName: row.name,
        currentCourse: row.currentCourse,
        interestedCourse: row.interestedCourse,
        totalQuestions: row.total_questions,
        correctAnswers: row.correct_answers,
        incorrectAnswers: row.wrong_answers,
        score: row.score,
        accuracy: row.accuracy,
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

/* SERVER START */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
