const db = require('./db');

const queries = [
  // 1. Create questions table
  `CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course VARCHAR(100) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    text TEXT NOT NULL,
    options JSON,
    answer VARCHAR(255) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 2. Add columns to results table
  // We'll use a procedure or try/catch around alter table since IF NOT EXISTS doesn't work simply for columns in older MySQL.
  // Actually, we can just run ALTER TABLE and ignore errors if column exists.
];

async function updateDB() {
  for (let q of queries) {
    await new Promise((resolve) => {
      db.query(q, (err) => {
        if (err) console.log("Note (might be expected):", err.message);
        else console.log("Query success");
        resolve();
      });
    });
  }

  // Safe idempotent column addition using INFORMATION_SCHEMA to prevent duplicates
  const columnsToAdd = [
    { name: "attempt_id", definition: "VARCHAR(100)" },
    { name: "currentCourse", definition: "VARCHAR(100)" },
    { name: "interestedCourse", definition: "VARCHAR(100)" },
    { name: "total_questions", definition: "INT DEFAULT 0" },
    { name: "correct_answers", definition: "INT DEFAULT 0" },
    { name: "wrong_answers", definition: "INT DEFAULT 0" },
    { name: "accuracy", definition: "FLOAT DEFAULT 0" },
    { name: "topicPerformance", definition: "TEXT" },
    { name: "difficultyPerformance", definition: "TEXT" },
    { name: "weak_areas", definition: "TEXT" },
    { name: "feedback", definition: "TEXT" },
    // Phase 1 ML feature collection columns
    { name: "time_taken_sec", definition: "INT DEFAULT NULL" },
    { name: "avg_time_per_question", definition: "FLOAT DEFAULT NULL" },
    { name: "quiz_difficulty", definition: "VARCHAR(50) DEFAULT NULL" },
    { name: "question_type", definition: "VARCHAR(50) DEFAULT NULL" },
    { name: "subject", definition: "VARCHAR(100) DEFAULT NULL" },
    { name: "unanswered_count", definition: "INT DEFAULT NULL" }
  ];

  const dbName = process.env.DB_NAME || "student_db";

  for (const col of columnsToAdd) {
    await new Promise((resolve) => {
      const checkSql = `
        SELECT COUNT(*) AS count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'results' AND COLUMN_NAME = ?
      `;
      db.query(checkSql, [dbName, col.name], (checkErr, rows) => {
        if (checkErr) {
          console.error(`Error checking column ${col.name}:`, checkErr.message);
          return resolve();
        }
        if (rows[0].count > 0) {
          console.log(`Column '${col.name}' already exists in results. Skipping.`);
          return resolve();
        }
        const alterSql = `ALTER TABLE results ADD COLUMN \`${col.name}\` ${col.definition}`;
        db.query(alterSql, (alterErr) => {
          if (alterErr) console.error(`Error adding '${col.name}':`, alterErr.message);
          else console.log(`Added column '${col.name}' (${col.definition}) to results.`);
          resolve();
        });
      });
    });
  }

  console.log("Database update complete");
  process.exit();
}

updateDB();
