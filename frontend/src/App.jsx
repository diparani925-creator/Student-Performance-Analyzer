import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import StudentForm from './components/StudentForm';
import QuizConfig from './components/QuizConfig';
import QuizPage from './components/QuizPage';
import ResultAnalysis from './components/ResultAnalysis';

function App() {
  const [quizSettings, setQuizSettings] = useState(null);
  const [quizResult, setQuizResult] = useState(null);

  return (
    <Router>
      <div className="min-h-screen bg-gradient">
        <Routes>
          <Route 
            path="/" 
            element={<StudentForm />} 
          />
          <Route 
            path="/quiz-config" 
            element={<QuizConfig setQuizSettings={setQuizSettings} />} 
          />
          <Route 
            path="/quiz" 
            element={<QuizPage quizSettings={quizSettings} setQuizResult={setQuizResult} />} 
          />
          <Route 
            path="/result" 
            element={<ResultAnalysis quizResult={quizResult} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
