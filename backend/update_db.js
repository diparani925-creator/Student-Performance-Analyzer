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

  // Handle ALTER TABLE individually to safely ignore duplicate column errors
  const alterQueries = [
    `ALTER TABLE results ADD COLUMN attempt_id VARCHAR(100)`,
    `ALTER TABLE results ADD COLUMN currentCourse VARCHAR(100)`,
    `ALTER TABLE results ADD COLUMN interestedCourse VARCHAR(100)`,
    `ALTER TABLE results ADD COLUMN total_questions INT DEFAULT 0`,
    `ALTER TABLE results ADD COLUMN correct_answers INT DEFAULT 0`,
    `ALTER TABLE results ADD COLUMN wrong_answers INT DEFAULT 0`,
    `ALTER TABLE results ADD COLUMN accuracy FLOAT DEFAULT 0`,
    `ALTER TABLE results ADD COLUMN topicPerformance TEXT`,
    `ALTER TABLE results ADD COLUMN difficultyPerformance TEXT`,
    `ALTER TABLE results ADD COLUMN weak_areas TEXT`,
    `ALTER TABLE results ADD COLUMN feedback TEXT`
  ];

  for (let q of alterQueries) {
    await new Promise((resolve) => {
      db.query(q, (err) => {
        if (err) console.log(`Note for ALTER: ${err.message}`);
        resolve();
      });
    });
  }

  console.log("Database update complete");
  process.exit();
}

updateDB();
