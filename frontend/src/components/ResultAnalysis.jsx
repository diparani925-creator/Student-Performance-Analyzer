import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function ResultAnalysis({ quizResult }) {
  const navigate = useNavigate();
  const [filteredAttempts, setFilteredAttempts] = useState([]);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [mlLoading, setMlLoading] = useState(true);
  const saveChecked = useRef(null);

  useEffect(() => {
    if (!quizResult) {
      navigate('/');
      return;
    }

    if (saveChecked.current === quizResult.id) {
      return;
    }
    saveChecked.current = quizResult.id;

    const saveAndLoadHistory = async () => {
      // 1. Format date and time (includes time format e.g. Aug 17, 2026, 10:28 PM)
      const attemptDateTime = quizResult.dateTime || new Date().toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
      });

      const attemptId = quizResult.attempt_id || quizResult.id;

      const newAttempt = {
        id: attemptId,
        attempt_id: attemptId,
        date: attemptDateTime,
        studentName: quizResult.studentName,
        currentCourse: quizResult.currentCourse,
        interestedCourse: quizResult.interestedCourse,
        subject: quizResult.subject || quizResult.interestedCourse,
        quizDifficulty: quizResult.quizDifficulty || 'Mixed',
        questionType: quizResult.questionType || 'MCQ',
        totalQuestions: quizResult.totalQuestions,
        correctAnswers: quizResult.correctAnswers,
        incorrectAnswers: quizResult.incorrectAnswers,
        unansweredCount: quizResult.unansweredCount ?? 0,
        score: quizResult.score,
        accuracy: quizResult.accuracy,
        timeTakenSec: quizResult.timeTakenSec ?? 0,
        avgTimePerQuestion: quizResult.avgTimePerQuestion ?? 0,
        topicPerformance: quizResult.topicPerformance,
        difficultyPerformance: quizResult.difficultyPerformance,
        weakAreas: quizResult.weakAreas || [],
        feedback: quizResult.feedback || ''
      };

      // 2. Save to local storage (always)
      const existing = localStorage.getItem('studentPerformanceAttempts');
      let attemptsList = [];
      try {
        attemptsList = existing ? JSON.parse(existing) : [];
      } catch (e) {
        attemptsList = [];
      }

      if (!attemptsList.some(att => att.id === newAttempt.id)) {
        attemptsList.push(newAttempt);
        localStorage.setItem('studentPerformanceAttempts', JSON.stringify(attemptsList));
      }

      // 3. Save to backend database
      let savedToBackend = false;
      try {
        const submitPayload = {
          attempt_id: attemptId,
          studentName: quizResult.studentName,
          currentCourse: quizResult.currentCourse,
          interestedCourse: quizResult.interestedCourse,
          subject: quizResult.subject || quizResult.interestedCourse,
          quiz_difficulty: quizResult.quizDifficulty || 'Mixed',
          question_type: quizResult.questionType || 'MCQ',
          score: quizResult.score,
          total: quizResult.totalQuestions,
          correct_answers: quizResult.correctAnswers,
          wrong_answers: quizResult.incorrectAnswers,
          unanswered_count: quizResult.unansweredCount ?? 0,
          accuracy: quizResult.accuracy,
          time_taken_sec: quizResult.timeTakenSec ?? 0,
          avg_time_per_question: quizResult.avgTimePerQuestion ?? 0,
          topicPerformance: quizResult.topicPerformance,
          difficultyPerformance: quizResult.difficultyPerformance,
          analysis: {
            weakTopics: quizResult.weakAreas || [],
            strengths: quizResult.strengths || [],
            suggestions: quizResult.feedback || '',
            studyPlan: quizResult.feedback || ''
          }
        };

        await axios.post('http://localhost:5000/api/submit-quiz', submitPayload);
        savedToBackend = true;
      } catch (err) {
        console.log('Backend save failed, using local storage.', err);
      }

      // 4. Fetch updated history
      let historyLoadedFromBackend = false;
      if (savedToBackend) {
        try {
          const url = `http://localhost:5000/api/results/student?name=${encodeURIComponent(quizResult.studentName)}&currentCourse=${encodeURIComponent(quizResult.currentCourse)}&interestedCourse=${encodeURIComponent(quizResult.interestedCourse)}`;
          const response = await axios.get(url);
          if (response.data && response.data.success) {
            setFilteredAttempts(response.data.results);
            historyLoadedFromBackend = true;
          }
        } catch (err) {
          console.log('Backend fetch history failed, using local storage fallback.', err);
        }
      }

      if (!historyLoadedFromBackend) {
        // Fallback: Filter local storage attempts
        const localFiltered = attemptsList.filter(att => 
          att.studentName?.toLowerCase().trim() === quizResult.studentName?.toLowerCase().trim() &&
          att.currentCourse?.toLowerCase().trim() === quizResult.currentCourse?.toLowerCase().trim() &&
          att.interestedCourse?.toLowerCase().trim() === quizResult.interestedCourse?.toLowerCase().trim()
        );
        setFilteredAttempts(localFiltered);
      }

      // 5. Fetch ML next-quiz prediction (honestly handles insufficient data or offline ML service)
      setMlLoading(true);
      try {
        const mlResponse = await axios.post('http://localhost:5000/api/ml/predict', {
          studentName: quizResult.studentName,
          currentCourse: quizResult.currentCourse,
          interestedCourse: quizResult.interestedCourse
        });
        setMlPrediction(mlResponse.data);
      } catch (mlErr) {
        const errData = mlErr.response?.data;
        setMlPrediction({
          success: false,
          model_name: errData?.model_name || 'Linear Regression (Scikit-learn)',
          model_status: errData?.model_status || 'service_unavailable',
          trained: false,
          prediction_available: false,
          predicted_next_accuracy: null,
          metrics_valid: false,
          evaluation_metrics: null,
          message: errData?.message || 'Python ML service is currently unavailable. Start ml_service/app.py to enable predictions.'
        });
      } finally {
        setMlLoading(false);
      }
    };

    saveAndLoadHistory();
  }, [quizResult, navigate]);

  if (!quizResult) return null;

  const {
    id,
    date,
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    score,
    accuracy,
    topicPerformance,
    difficultyPerformance,
    strengths,
    weakAreas,
    averageAreas,
    feedback,
    questionReview,
    studentName,
    currentCourse,
    interestedCourse
  } = quizResult;

  // Safe data calculations to handle edge cases/missing data
  const safeCorrect = correctAnswers ?? 0;
  const safeIncorrect = incorrectAnswers ?? 0;
  const safeTotalQuestions = totalQuestions ?? (safeCorrect + safeIncorrect);
  const safeAccuracy = accuracy ?? (safeTotalQuestions > 0 ? (safeCorrect / safeTotalQuestions) * 100 : 0);
  const safeScore = score ?? safeCorrect;

  const totalAns = safeCorrect + safeIncorrect;
  const correctPct = totalAns > 0 ? ((safeCorrect / totalAns) * 100).toFixed(0) : 0;
  const incorrectPct = totalAns > 0 ? ((safeIncorrect / totalAns) * 100).toFixed(0) : 0;

  // Calculate dynamic improvement indicator relative to previous attempt
  let currentAttemptIndex = filteredAttempts.findIndex(att => att.id === id);
  if (currentAttemptIndex === -1 && filteredAttempts.length > 0) {
    currentAttemptIndex = filteredAttempts.length - 1;
  }
  const prevAttempt = currentAttemptIndex > 0 ? filteredAttempts[currentAttemptIndex - 1] : null;

  let improvementText = "";
  let improvementColor = "var(--text-muted)";
  if (!prevAttempt) {
    improvementText = "First attempt — complete another quiz to track your progress.";
  } else {
    const diff = safeAccuracy - prevAttempt.accuracy;
    if (diff > 0) {
      improvementText = `↑ ${diff.toFixed(0)}% improvement`;
      improvementColor = "var(--secondary)"; // Green
    } else if (diff < 0) {
      improvementText = `↓ ${Math.abs(diff).toFixed(0)}% decrease`;
      improvementColor = "var(--danger)"; // Red
    } else {
      improvementText = "→ No change";
      improvementColor = "#f59e0b"; // Yellow
    }
  }

  // Calculate best accuracy and score across all saved attempts safely (prevents crashing on corrupt data)
  const bestAccuracy = filteredAttempts.length > 0 
    ? Math.max(...filteredAttempts.map(att => typeof att.accuracy === 'number' && !isNaN(att.accuracy) ? att.accuracy : 0)) 
    : safeAccuracy;

  const bestScore = filteredAttempts.length > 0 
    ? Math.max(...filteredAttempts.map(att => typeof att.score === 'number' && !isNaN(att.score) ? att.score : 0)) 
    : safeScore;


  // Sorting topic performance by accuracy descending
  const sortedTopics = [...(topicPerformance || [])].sort((a, b) => b.accuracy - a.accuracy);

  // Sorting difficulty performance by difficulty order: Easy, Medium, Hard
  const diffOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
  const sortedDifficulty = [...(difficultyPerformance || [])].sort(
    (a, b) => (diffOrder[a.difficulty] || 99) - (diffOrder[b.difficulty] || 99)
  );

  const hasTopicData = sortedTopics && sortedTopics.length > 0;
  const hasDifficultyData = sortedDifficulty && sortedDifficulty.length > 0;

  // Correct vs Incorrect Chart Data & Options
  const doughnutChartData = {
    labels: ['Correct', 'Incorrect'],
    datasets: [{
      data: [safeCorrect, safeIncorrect],
      backgroundColor: ['#10B981', '#EF4444'],
      hoverOffset: 4,
      borderWidth: 0
    }]
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: 12,
            weight: '500',
            family: "'Inter', sans-serif"
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.parsed;
            const total = safeCorrect + safeIncorrect;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
            return ` ${context.label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '70%'
  };

  // Performance by Topic Chart Data & Options
  const topicChartData = {
    labels: sortedTopics.map(t => t.topic.length > 15 ? t.topic.substring(0, 12) + '...' : t.topic),
    datasets: [{
      data: sortedTopics.map(t => t.accuracy),
      backgroundColor: sortedTopics.map(t => t.accuracy >= 70 ? '#10B981' : t.accuracy < 40 ? '#EF4444' : '#F59E0B'),
      borderRadius: 6,
      borderWidth: 0,
      barThickness: 24
    }]
  };

  const topicChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            const item = sortedTopics[context[0].dataIndex];
            return item ? item.topic : '';
          },
          label: function(context) {
            const item = sortedTopics[context.dataIndex];
            if (item) {
              return [
                `Accuracy: ${item.accuracy.toFixed(0)}%`,
                `Correct: ${item.correct}`,
                `Total: ${item.total}`
              ];
            }
            return `Accuracy: ${context.parsed.y}%`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Accuracy (%)',
          font: {
            weight: 'bold',
            family: "'Inter', sans-serif"
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11
          },
          maxRotation: 45,
          minRotation: 0
        }
      }
    }
  };

  // Performance by Difficulty Chart Data & Options
  const difficultyChartData = {
    labels: sortedDifficulty.map(d => d.difficulty),
    datasets: [{
      data: sortedDifficulty.map(d => d.accuracy),
      backgroundColor: sortedDifficulty.map(d => d.difficulty === 'Easy' ? '#10B981' : d.difficulty === 'Hard' ? '#EF4444' : '#F59E0B'),
      borderRadius: 6,
      borderWidth: 0,
      barThickness: 32
    }]
  };

  const difficultyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            const item = sortedDifficulty[context[0].dataIndex];
            return item ? `${item.difficulty} Difficulty` : '';
          },
          label: function(context) {
            const item = sortedDifficulty[context.dataIndex];
            if (item) {
              return [
                `Accuracy: ${item.accuracy.toFixed(0)}%`,
                `Correct: ${item.correct}`,
                `Total: ${item.total}`
              ];
            }
            return `Accuracy: ${context.parsed.y}%`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Accuracy (%)',
          font: {
            weight: 'bold',
            family: "'Inter', sans-serif"
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 12
          }
        }
      }
    }
  };

  // Performance Trend Line Chart Data & Options safely mapped
  const trendChartData = {
    labels: filteredAttempts.map((att, idx) => `Attempt ${idx + 1}`),
    datasets: [{
      label: 'Accuracy (%)',
      data: filteredAttempts.map(att => typeof att.accuracy === 'number' && !isNaN(att.accuracy) ? att.accuracy : 0),
      borderColor: '#4F46E5',
      backgroundColor: 'rgba(79, 70, 229, 0.1)',
      tension: 0.3,
      fill: true,
      pointBackgroundColor: '#4F46E5',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            const att = filteredAttempts[context[0].dataIndex];
            return att ? `Attempt #${context[0].dataIndex + 1}` : '';
          },
          label: function(context) {
            const attempt = filteredAttempts[context.dataIndex];
            if (attempt) {
              const acc = typeof attempt.accuracy === 'number' && !isNaN(attempt.accuracy) ? attempt.accuracy : 0;
              const sc = typeof attempt.score === 'number' && !isNaN(attempt.score) ? attempt.score : 0;
              const tq = typeof attempt.totalQuestions === 'number' && !isNaN(attempt.totalQuestions) ? attempt.totalQuestions : 0;
              return [
                `Accuracy: ${acc.toFixed(0)}%`,
                `Score: ${sc} / ${tq}`,
                `Date: ${attempt.date || ''}`
              ];
            }
            return `Accuracy: ${context.parsed.y}%`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Accuracy (%)',
          font: {
            weight: 'bold',
            family: "'Inter', sans-serif"
          }
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear your quiz history? This will delete all attempts for this profile.")) {
      // 1. Delete from local storage
      const existing = localStorage.getItem('studentPerformanceAttempts');
      let attemptsList = [];
      try {
        attemptsList = existing ? JSON.parse(existing) : [];
      } catch (e) {
        attemptsList = [];
      }
      const updatedAttempts = attemptsList.filter(att => 
        !(att.studentName?.toLowerCase().trim() === studentName?.toLowerCase().trim() &&
          att.currentCourse?.toLowerCase().trim() === currentCourse?.toLowerCase().trim() &&
          att.interestedCourse?.toLowerCase().trim() === interestedCourse?.toLowerCase().trim())
      );
      localStorage.setItem('studentPerformanceAttempts', JSON.stringify(updatedAttempts));

      // 2. Delete from backend database
      try {
        const url = `http://localhost:5000/api/results/student?name=${encodeURIComponent(studentName)}&currentCourse=${encodeURIComponent(currentCourse)}&interestedCourse=${encodeURIComponent(interestedCourse)}`;
        await axios.delete(url);
      } catch (err) {
        console.log('Failed to clear backend history, cleared local storage only.', err);
      }

      setFilteredAttempts([]);
      alert("Quiz history cleared successfully.");
      navigate('/');
    }
  };

  return (
    <div className="container" style={{ maxWidth: '1000px', padding: '20px' }}>
      <div className="card" style={{ animation: 'fadeIn 0.5s ease-out', padding: '30px' }}>
        
        {/* Title Header */}
        <h2 className="title" style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '20px' }}>
          Performance Report
        </h2>

        {/* Student Profile Info Panel */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '20px', 
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
          padding: '20px', 
          borderRadius: '16px', 
          marginBottom: '2rem',
          border: '1px solid var(--border)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Student Name</span>
            <h3 style={{ color: 'var(--text-main)', marginTop: '4px', fontSize: '1.25rem', fontWeight: 600 }}>{studentName}</h3>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Current Course</span>
            <h3 style={{ color: 'var(--text-main)', marginTop: '4px', fontSize: '1.25rem', fontWeight: 600 }}>{currentCourse}</h3>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Interested Field</span>
            <h3 style={{ color: 'var(--text-main)', marginTop: '4px', fontSize: '1.25rem', fontWeight: 600 }}>{interestedCourse}</h3>
          </div>
        </div>

        {/* Score & Summary Cards Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px', 
          marginBottom: '2.5rem' 
        }}>
          {/* Score Card */}
          <div style={{ 
            padding: '24px', 
            background: 'white', 
            borderRadius: '16px', 
            border: '1px solid var(--border)', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            textAlign: 'center'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Score</span>
            <h2 style={{ fontSize: '2.25rem', color: 'var(--primary)', marginTop: '8px', fontWeight: 700 }}>
              {safeScore} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {safeTotalQuestions}</span>
            </h2>
          </div>

          {/* Accuracy Card */}
          <div style={{ 
            padding: '24px', 
            background: 'white', 
            borderRadius: '16px', 
            border: '1px solid var(--border)', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            textAlign: 'center'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Accuracy</span>
            <h2 style={{ fontSize: '2.25rem', color: safeAccuracy >= 70 ? 'var(--secondary)' : safeAccuracy < 40 ? 'var(--danger)' : '#f59e0b', marginTop: '8px', fontWeight: 700 }}>
              {safeAccuracy.toFixed(0)}%
            </h2>
          </div>

          {/* Correct Answers Card */}
          <div style={{ 
            padding: '24px', 
            background: 'white', 
            borderRadius: '16px', 
            border: '1px solid var(--border)', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            textAlign: 'center'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Correct</span>
            <h2 style={{ fontSize: '2.25rem', color: 'var(--secondary)', marginTop: '8px', fontWeight: 700 }}>
              {safeCorrect}
            </h2>
          </div>

          {/* Incorrect Answers Card */}
          <div style={{ 
            padding: '24px', 
            background: 'white', 
            borderRadius: '16px', 
            border: '1px solid var(--border)', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            textAlign: 'center'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Incorrect</span>
            <h2 style={{ fontSize: '2.25rem', color: 'var(--danger)', marginTop: '8px', fontWeight: 700 }}>
              {safeIncorrect}
            </h2>
          </div>
        </div>

        {/* Improvement Indicator and Best Performance Card */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
          borderLeft: `5px solid ${improvementColor}`,
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '2.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              Performance Status & Progress
            </h4>
            <p style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
              {improvementText}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '15px', fontSize: '0.9rem' }}>
            <div style={{ background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Best Score:</span>{' '}
              <strong style={{ color: 'var(--primary)' }}>{bestScore} / {safeTotalQuestions}</strong>
            </div>
            <div style={{ background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Best Accuracy:</span>{' '}
              <strong style={{ color: 'var(--secondary)' }}>{bestAccuracy.toFixed(0)}%</strong>
            </div>
          </div>
        </div>

        {/* Personalized Feedback Block */}
        <div style={{ 
          background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', 
          borderLeft: '5px solid var(--primary)',
          padding: '24px', 
          borderRadius: '12px', 
          marginBottom: '2.5rem'
        }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '8px', fontWeight: 600, fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Personalized Feedback</h4>
          <p style={{ color: '#1e1b4b', fontSize: '1.1rem', lineHeight: '1.5', fontWeight: 500 }}>{feedback}</p>
        </div>

        {/* ML Performance Prediction Section */}
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '2.5rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
            <div>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                ML Next-Quiz Prediction
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
                Forecast based strictly on prior quiz history (zero data leakage)
              </p>
            </div>
            <span style={{
              background: mlLoading
                ? '#f1f5f9'
                : mlPrediction?.trained && mlPrediction?.prediction_available
                  ? '#d1fae5'
                  : mlPrediction?.model_status === 'insufficient_data'
                    ? '#fef3c7'
                    : '#fee2e2',
              color: mlLoading
                ? 'var(--text-muted)'
                : mlPrediction?.trained && mlPrediction?.prediction_available
                  ? '#065f46'
                  : mlPrediction?.model_status === 'insufficient_data'
                    ? '#92400e'
                    : '#991b1b',
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}>
              {mlLoading
                ? 'Analyzing...'
                : mlPrediction?.trained && mlPrediction?.prediction_available
                  ? 'Model Trained'
                  : mlPrediction?.model_status === 'insufficient_data'
                    ? 'Insufficient Training Data'
                    : 'Prediction Unavailable'}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '16px',
            marginBottom: '18px'
          }}>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Predicted Next Quiz Accuracy
              </span>
              <h3 style={{
                fontSize: '1.65rem',
                marginTop: '6px',
                fontWeight: 700,
                color: mlPrediction?.prediction_available && mlPrediction?.predicted_next_accuracy !== null ? 'var(--primary)' : 'var(--text-muted)'
              }}>
                {mlLoading
                  ? '...'
                  : mlPrediction?.prediction_available && mlPrediction?.predicted_next_accuracy !== null && mlPrediction?.predicted_next_accuracy !== undefined
                    ? `${Number(mlPrediction.predicted_next_accuracy).toFixed(1)}%`
                    : 'Unavailable'}
              </h3>
            </div>

            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Previous Quiz Accuracy
              </span>
              <h3 style={{ fontSize: '1.65rem', marginTop: '6px', fontWeight: 700, color: 'var(--text-main)' }}>
                {mlPrediction?.previous_accuracy !== null && mlPrediction?.previous_accuracy !== undefined
                  ? `${Number(mlPrediction.previous_accuracy).toFixed(0)}%`
                  : prevAttempt
                    ? `${Number(prevAttempt.accuracy).toFixed(0)}%`
                    : 'First Attempt'}
              </h3>
            </div>

            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Performance Trend
              </span>
              <h3 style={{ fontSize: '1.15rem', marginTop: '10px', fontWeight: 600, color: improvementColor }}>
                {mlPrediction?.performance_trend
                  || (prevAttempt
                    ? (safeAccuracy > prevAttempt.accuracy
                      ? `Improving (+${(safeAccuracy - prevAttempt.accuracy).toFixed(0)}%)`
                      : safeAccuracy < prevAttempt.accuracy
                        ? `Declining (${(safeAccuracy - prevAttempt.accuracy).toFixed(0)}%)`
                        : 'Stable (0%)')
                    : 'First Attempt')}
              </h3>
            </div>

            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>
                ML Model Name
              </span>
              <h3 style={{ fontSize: '1.05rem', marginTop: '10px', fontWeight: 600, color: 'var(--text-main)' }}>
                {mlPrediction?.model_name || 'Linear Regression (Scikit-learn)'}
              </h3>
            </div>
          </div>

          {/* Model Evaluation Metrics — displayed ONLY when real training & validation succeeded */}
          {!mlLoading && mlPrediction?.trained && mlPrediction?.metrics_valid && mlPrediction?.evaluation_metrics && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <h4 style={{ color: '#065f46', fontSize: '0.92rem', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>
                  Model Evaluation Metrics
                </h4>
                {mlPrediction.training_summary && (
                  <span style={{ color: '#047857', fontSize: '0.82rem', fontWeight: 500 }}>
                    Split: {mlPrediction.training_summary.split_strategy} ({mlPrediction.training_summary.train_samples} train / {mlPrediction.training_summary.test_samples} test)
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div>
                  <span style={{ color: '#047857', fontSize: '0.8rem', display: 'block' }}>MAE</span>
                  <strong style={{ color: '#065f46', fontSize: '1.1rem' }}>{mlPrediction.evaluation_metrics.mae}</strong>
                </div>
                <div>
                  <span style={{ color: '#047857', fontSize: '0.8rem', display: 'block' }}>MSE</span>
                  <strong style={{ color: '#065f46', fontSize: '1.1rem' }}>{mlPrediction.evaluation_metrics.mse}</strong>
                </div>
                <div>
                  <span style={{ color: '#047857', fontSize: '0.8rem', display: 'block' }}>RMSE</span>
                  <strong style={{ color: '#065f46', fontSize: '1.1rem' }}>{mlPrediction.evaluation_metrics.rmse}</strong>
                </div>
                <div>
                  <span style={{ color: '#047857', fontSize: '0.8rem', display: 'block' }}>R² Score</span>
                  <strong style={{ color: '#065f46', fontSize: '1.1rem' }}>{mlPrediction.evaluation_metrics.r2}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Honest Insufficient Data / Status Notice */}
          {!mlLoading && (!mlPrediction?.trained || !mlPrediction?.prediction_available) && (
            <div style={{
              background: mlPrediction?.model_status === 'insufficient_data' ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${mlPrediction?.model_status === 'insufficient_data' ? '#fde68a' : '#fecaca'}`,
              borderRadius: '12px',
              padding: '14px 16px',
              color: mlPrediction?.model_status === 'insufficient_data' ? '#92400e' : '#991b1b',
              fontSize: '0.92rem',
              lineHeight: '1.5'
            }}>
              <strong>ML Status Notice:</strong>{' '}
              {mlPrediction?.message || 'Insufficient historical training data to generate a prediction.'}
              {mlPrediction?.training_summary && (
                <div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
                  MySQL records: <strong>{mlPrediction.training_summary.total_db_records}</strong> | Usable multi-attempt training pairs:{' '}
                  <strong>{mlPrediction.training_summary.usable_training_pairs}</strong> / {mlPrediction.training_summary.min_required_pairs} required
                </div>
              )}
            </div>
          )}
        </div>

        {/* Strengths & Weaknesses Categories */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '20px', 
          marginBottom: '2.5rem' 
        }}>
          {/* Strengths */}
          <div style={{ padding: '20px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '16px' }}>
            <h4 style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: 600 }}>
              <span style={{ fontSize: '1.2rem' }}>💪</span> Strengths (Acc ≥ 70%)
            </h4>
            {strengths && strengths.length > 0 ? (
              <ul style={{ paddingLeft: '20px', margin: 0, color: '#047857', lineHeight: '1.6' }}>
                {strengths.map((s, idx) => <li key={idx} style={{ fontWeight: 555 }}>{s}</li>)}
              </ul>
            ) : (
              <p style={{ color: '#065f46', fontSize: '0.95rem', fontStyle: 'italic', margin: 0 }}>No topics currently meet the strength threshold.</p>
            )}
          </div>

          {/* Average Areas */}
          <div style={{ padding: '20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px' }}>
            <h4 style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: 600 }}>
              <span style={{ fontSize: '1.2rem' }}>📖</span> Needs Practice (40% - 69%)
            </h4>
            {averageAreas && averageAreas.length > 0 ? (
              <ul style={{ paddingLeft: '20px', margin: 0, color: '#b45309', lineHeight: '1.6' }}>
                {averageAreas.map((a, idx) => <li key={idx} style={{ fontWeight: 555 }}>{a}</li>)}
              </ul>
            ) : (
              <p style={{ color: '#92400e', fontSize: '0.95rem', fontStyle: 'italic', margin: 0 }}>No topics currently fall in the average category.</p>
            )}
          </div>

          {/* Weak Areas */}
          <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px' }}>
            <h4 style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: 600 }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span> Needs Improvement (&lt; 40%)
            </h4>
            {weakAreas && weakAreas.length > 0 ? (
              <ul style={{ paddingLeft: '20px', margin: 0, color: '#b91c1c', lineHeight: '1.6' }}>
                {weakAreas.map((w, idx) => <li key={idx} style={{ fontWeight: 555 }}>{w}</li>)}
              </ul>
            ) : (
              <p style={{ color: '#991b1b', fontSize: '0.95rem', fontStyle: 'italic', margin: 0 }}>Excellent! No severe weak topics identified.</p>
            )}
          </div>
        </div>

        {/* Visual Charts Section - Vertical Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', marginBottom: '3rem' }}>
          {/* Performance by Topic Bar Chart */}
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid var(--border)', 
            padding: '24px', 
            borderRadius: '16px', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' 
          }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '20px', fontSize: '1.25rem', fontWeight: 600 }}>Performance by Topic</h3>
            {hasTopicData ? (
              <div style={{ height: '320px', width: '100%', position: 'relative' }}>
                <Bar data={topicChartData} options={topicChartOptions} />
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px 0' }}>No performance data available.</p>
            )}
          </div>

          {/* Correct vs Incorrect Donut Chart */}
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid var(--border)', 
            padding: '24px', 
            borderRadius: '16px', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '20px', fontSize: '1.25rem', fontWeight: 600, width: '100%', textAlign: 'left' }}>
              Correct vs Incorrect Answers
            </h3>
            {safeTotalQuestions > 0 ? (
              <div style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
                  <div style={{
                    position: 'absolute',
                    top: '46%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Accuracy</span>
                    <h3 style={{ fontSize: '1.6rem', color: 'var(--text-main)', margin: '2px 0 0', fontWeight: 700 }}>{safeAccuracy.toFixed(0)}%</h3>
                  </div>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-around', 
                  marginTop: '20px', 
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border)',
                  width: '100%'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Correct</span>
                    <span style={{ fontSize: '1.15rem', color: '#10B981', fontWeight: 700 }}>{safeCorrect} ({correctPct}%)</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Incorrect</span>
                    <span style={{ fontSize: '1.15rem', color: '#EF4444', fontWeight: 700 }}>{safeIncorrect} ({incorrectPct}%)</span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px 0', width: '100%' }}>No performance data available.</p>
            )}
          </div>

          {/* Performance by Difficulty Bar Chart */}
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid var(--border)', 
            padding: '24px', 
            borderRadius: '16px', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' 
          }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '20px', fontSize: '1.25rem', fontWeight: 600 }}>Performance by Difficulty</h3>
            {hasDifficultyData ? (
              <div style={{ height: '300px', width: '100%', position: 'relative' }}>
                <Bar data={difficultyChartData} options={difficultyChartOptions} />
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px 0' }}>No performance data available.</p>
            )}
          </div>

          {/* Performance Trend Line Chart */}
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid var(--border)', 
            padding: '24px', 
            borderRadius: '16px', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' 
          }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '20px', fontSize: '1.25rem', fontWeight: 600 }}>Performance Trend</h3>
            {filteredAttempts.length > 1 ? (
              <div style={{ height: '300px', width: '100%', position: 'relative' }}>
                <Line data={trendChartData} options={trendChartOptions} />
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0', fontSize: '0.95rem', fontStyle: 'italic' }}>
                Complete another quiz to see your performance trend.
              </p>
            )}
          </div>

          {/* Previous Attempts Section */}
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid var(--border)', 
            padding: '24px', 
            borderRadius: '16px', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Previous Attempts</h3>
              <button 
                className="btn btn-secondary" 
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem', color: 'var(--danger)' }}
                onClick={handleClearHistory}
              >
                Clear History
              </button>
            </div>
            {filteredAttempts.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Attempt</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Score</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.map((att, idx) => {
                      const isLatest = att.id === id;
                      return (
                        <tr 
                          key={att.id} 
                          style={{ 
                            borderBottom: '1px solid var(--border)',
                            background: isLatest ? '#eff6ff' : 'transparent',
                            fontWeight: isLatest ? '600' : 'normal'
                          }}
                        >
                          <td style={{ padding: '12px 8px' }}>
                            #{idx + 1} {isLatest && <span style={{ background: 'var(--primary)', color: 'white', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 600 }}>Latest</span>}
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{att.date}</td>
                          <td style={{ padding: '12px 8px' }}>{att.score} / {att.totalQuestions}</td>
                          <td style={{ padding: '12px 8px', color: (att.accuracy ?? 0) >= 70 ? 'var(--secondary)' : (att.accuracy ?? 0) < 40 ? 'var(--danger)' : '#f59e0b' }}>
                            {(typeof att.accuracy === 'number' && !isNaN(att.accuracy) ? att.accuracy : 0).toFixed(0)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No previous attempts available.</p>
            )}
          </div>
        </div>

        {/* Question Review Section */}
        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ color: 'var(--text-main)', marginBottom: '20px', fontSize: '1.4rem', fontWeight: 600 }}>Question Review</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {questionReview && questionReview.map((qr, idx) => (
              <div 
                key={idx}
                style={{ 
                  padding: '24px', 
                  background: 'white', 
                  borderRadius: '16px', 
                  border: '1px solid var(--border)', 
                  borderLeft: `6px solid ${qr.isCorrect ? 'var(--secondary)' : 'var(--danger)'}`,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                }}
              >
                {/* Header info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ 
                    color: qr.isCorrect ? 'var(--secondary)' : 'var(--danger)', 
                    fontWeight: 700, 
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {qr.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {qr.topic}
                    </span>
                    <span style={{ 
                      background: qr.difficulty === 'Easy' ? '#d1fae5' : qr.difficulty === 'Hard' ? '#fee2e2' : '#fef3c7',
                      color: qr.difficulty === 'Easy' ? '#065f46' : qr.difficulty === 'Hard' ? '#991b1b' : '#92400e',
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.8rem', 
                      fontWeight: 600 
                    }}>
                      {qr.difficulty}
                    </span>
                  </div>
                </div>

                {/* Question Text */}
                <h4 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                  Q{idx + 1}. {qr.question}
                </h4>

                {/* Answers Details */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                  gap: '12px', 
                  background: '#f8fafc', 
                  padding: '16px', 
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  fontSize: '0.95rem'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>Your Answer:</span>
                    <strong style={{ color: qr.isCorrect ? 'var(--secondary)' : 'var(--danger)' }}>
                      {qr.selectedAnswer ? qr.selectedAnswer : <span style={{ fontStyle: 'italic', fontWeight: 400 }}>(Unanswered)</span>}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>Correct Answer:</span>
                    <strong style={{ color: 'var(--secondary)' }}>{qr.correctAnswer}</strong>
                  </div>
                </div>

                {/* Explanation */}
                {qr.explanation && (
                  <div style={{ marginTop: '16px', padding: '12px 16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.9rem', color: '#1e3a8a', lineHeight: '1.5' }}>
                    <strong>Explanation:</strong> {qr.explanation}
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>

        {/* Retry / Control Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          gap: '20px', 
          flexWrap: 'wrap',
          borderTop: '1px solid var(--border)',
          paddingTop: '2rem'
        }}>
          <button 
            className="btn btn-secondary" 
            style={{ flex: 1, minWidth: '180px' }} 
            onClick={() => navigate('/quiz-config')}
          >
            Try Again
          </button>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1, minWidth: '180px' }} 
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>

      </div>
    </div>
  );
}

export default ResultAnalysis;
