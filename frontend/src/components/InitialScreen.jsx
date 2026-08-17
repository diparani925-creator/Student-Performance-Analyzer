import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function InitialScreen({ setStudentData }) {
  const [name, setName] = useState('');
  const [stream, setStream] = useState('');
  const navigate = useNavigate();

  const handleContinue = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }
    setStudentData({
      name,
      course: "Graduation",
      stream: stream || "General"
    });
    navigate('/config');
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '500px', margin: '4rem auto' }}>
        <h2 className="title">Student Performance Analyzer</h2>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-muted)' }}>
          Exclusive Portal for Graduation Students
        </p>

        <form onSubmit={handleContinue}>
          <div className="form-group">
            <label>Student Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required 
            />
          </div>

          <div className="form-group">
            <label>Current Course</label>
            <input 
              type="text" 
              className="form-control" 
              value="Graduation"
              disabled 
              style={{ background: '#e2e8f0', cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group">
            <label>Stream / Branch (Optional)</label>
            <select 
              className="form-control"
              value={stream}
              onChange={(e) => setStream(e.target.value)}
            >
              <option value="">Select Stream</option>
              <option value="BCA">BCA (Computer Applications)</option>
              <option value="B.Tech">B.Tech (Engineering)</option>
              <option value="B.Sc">B.Sc (Science)</option>
              <option value="B.Com">B.Com (Commerce)</option>
              <option value="BA">BA (Arts)</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary mt-4">
            Continue to Quiz Configuration
          </button>
        </form>
      </div>
    </div>
  );
}

export default InitialScreen;
