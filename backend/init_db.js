const db = require('./db');

const queries = [
  `CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  )`,
  `INSERT IGNORE INTO courses (name) VALUES ('Class 10'), ('JEE Preparation')`,
  `INSERT IGNORE INTO subjects (course_id, name) VALUES 
    (1, 'Mathematics'), (1, 'Science'), (1, 'English'),
    (2, 'Physics'), (2, 'Chemistry'), (2, 'Mathematics')`
];

async function runQueries() {
  for (let q of queries) {
    await new Promise((resolve, reject) => {
      db.query(q, (err, result) => {
        if (err) console.error("Error running query:", err);
        else console.log("Query success");
        resolve();
      });
    });
  }
  process.exit();
}

runQueries();
