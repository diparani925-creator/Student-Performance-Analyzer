const db = require('./db');
const bcrypt = require('bcrypt');

async function setupDB() {
  try {
    // 1. Create users table if not exists (with role)
    await new Promise((resolve, reject) => {
      db.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'student') DEFAULT 'student',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, (err) => err ? reject(err) : resolve());
    });

    // 2. Add role column if it doesn't exist
    await new Promise((resolve) => {
      db.query(`ALTER TABLE users ADD COLUMN role ENUM('admin', 'student') DEFAULT 'student'`, (err) => resolve());
    });

    // 3. Add email column if it doesn't exist
    await new Promise((resolve) => {
      db.query(`ALTER TABLE users ADD COLUMN email VARCHAR(100) NOT NULL UNIQUE`, (err) => resolve());
    });

    // 4. Create an admin user
    const hashedAdmin = await bcrypt.hash('admin123', 10);
    await new Promise((resolve) => {
      db.query(`INSERT IGNORE INTO users (email, password, role) VALUES ('admin@test.com', ?, 'admin')`, [hashedAdmin], (err) => resolve());
    });

    // 5. Create a student user
    const hashedStudent = await bcrypt.hash('student123', 10);
    await new Promise((resolve) => {
      db.query(`INSERT IGNORE INTO users (email, password, role) VALUES ('student@test.com', ?, 'student')`, [hashedStudent], (err) => resolve());
    });

    // 6. Ensure results table exists for the admin page
    await new Promise((resolve) => {
      db.query(`CREATE TABLE IF NOT EXISTS results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attempt_id VARCHAR(100),
        name VARCHAR(100),
        currentCourse VARCHAR(100),
        interestedCourse VARCHAR(100),
        score INT,
        total_questions INT DEFAULT 0,
        correct_answers INT DEFAULT 0,
        wrong_answers INT DEFAULT 0,
        accuracy FLOAT DEFAULT 0.0,
        topicPerformance TEXT,
        difficultyPerformance TEXT,
        weak_areas TEXT,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, (err) => resolve());
    });

    console.log("✅ DB setup complete.");
    process.exit();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
setupDB();
