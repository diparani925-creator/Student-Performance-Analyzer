# Student Performance Analyzer

An AI-powered assessment, tracking, and analytics application designed to evaluate student proficiency, chart progress over time, and provide personalized feedback. The application generates customized tests tailored to a student's current course and interested fields, tracking history across multiple attempts with robust database integration and localStorage fallbacks.

## 🚀 Key Features

1. **Personalized Profiles:** Profile creation with searchable dropdowns for course selection and interest fields.
2. **AI-Powered Question Generation:** Tailored assessments generated dynamically using Gemini AI (with Hugging Face and local curated fallback question pools if offline).
3. **Flexible Configurations:** Customizable question counts (5-10), difficulties (Easy, Medium, Hard, Mixed), and formats (Multiple Choice or Numerical).
4. **Interactive Quiz Interface:** Built-in timer with auto-submit validation on expiration, option states persistence, and progress trackers.
5. **Aesthetic Performance Dashboard:**
   - **Correct vs. Incorrect:** Doughnut chart highlighting ratio and percentage.
   - **Performance by Topic:** Color-coded Bar chart showing topic-wise accuracy.
   - **Performance by Difficulty:** Bar chart breaking down accuracy by easy, medium, and hard levels.
6. **Multi-Attempt History & Trends:**
   - History logs stored concurrently in a MySQL database and client `localStorage`.
   - Isolated history tracks filtered dynamically by `Student Name + Course + Interest Field`.
   - **Performance Trend Line Chart:** Tracking accuracy progression across successive attempts.
   - **Dynamic Improvement Indicator:** Real-time feedback calculating percentage increases (`↑`) or decreases (`↓`) compared to the previous attempt.
7. **Single Command Runner:** Run the entire stack concurrently using a single command.

---

## 🛠️ Tech Stack

* **Frontend:** React (v19), Vite, React Router, Chart.js & React-Chartjs-2, Axios, CSS Variables (sleek modern design system).
* **Backend:** Node.js, Express, MySQL (`mysql2` driver), `@google/generative-ai` SDK.

---

## ⚙️ Environment Configuration

Create a `.env` file in the `backend/` directory with the following variables:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=student_db
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
HUGGINGFACE_API_KEY=your_huggingface_token
```

---

## 📦 Installation & Setup

### 1. Install Dependencies
Install modules at the root of the project (installs execution utilities) as well as subfolders:

```bash
# Install root runner dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Initialize the Database
Run the schema creation and database scripts (ensure MySQL is running and database `student_db` exists):

```bash
cd ../backend
node init_db.js
node setup_roles.js
node update_db.js
```

### 3. Run the Application
Start both the backend server and frontend development server concurrently from the project root:

```bash
cd ..
npm run dev
```

* **Frontend Dev URL:** `http://localhost:5173/`
* **Backend Port:** `http://localhost:5000`
