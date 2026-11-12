import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function QuizConfig({ setQuizSettings }) {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('');
  const [currentCourse, setCurrentCourse] = useState('');
  
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('Mixed');
  const [count, setCount] = useState(10);
  const [type, setType] = useState('MCQ');

  useEffect(() => {
    const name = localStorage.getItem('studentName');
    const course = localStorage.getItem('currentCourse');
    const interested = localStorage.getItem('interestedCourse');
    
    if (!name || !course || !interested) {
      navigate('/');
    } else {
      setStudentName(name);
      setCurrentCourse(course);
      setSubject(interested);
    }
  }, [navigate]);

  const handleStart = (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      alert("Please enter a subject");
      return;
    }
    setQuizSettings({ subject: subject.trim(), difficulty, count, type });
    navigate('/quiz');
  };

  if (!studentName) return null;

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '600px', margin: '4rem auto' }}>
        <h2 className="title">Configure Your Quiz</h2>
        <p style={{ textAlign: 'center', marginBottom: '2rem' }}>
          Welcome, <b>{studentName}</b> ({currentCourse})
        </p>

        <form onSubmit={handleStart}>
          <div className="form-group">
            <label>Subject</label>
            <input 
              type="text" 
              className="form-control" 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Mathematics, Database Management, etc."
              required
            />
          </div>

          <div className="flex gap-4">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Difficulty</label>
              <select className="form-control" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="Mixed">Mixed (Recommended)</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>No. of Questions</label>
              <input 
                type="number" 
                className="form-control" 
                min="1" max="20" 
                value={count} 
                onChange={(e) => setCount(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Question Type</label>
            <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="MCQ">Multiple Choice Questions</option>
              <option value="Numerical">Numerical</option>
            </select>
          </div>

          <div className="flex justify-between mt-8 gap-4">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Back</button>
            <button type="submit" className="btn btn-primary">Generate Quiz</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuizConfig;
