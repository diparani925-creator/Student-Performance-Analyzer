import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Structured Fallback Question Bank sorted by key subjects
const fallbackQuestionBank = {
  "machine learning": [
    {
      "question": "Which algorithm is commonly used for binary classification?",
      "options": ["Linear Regression", "Logistic Regression", "K-Means", "PCA"],
      "correctAnswer": "Logistic Regression",
      "topic": "Classification",
      "difficulty": "Easy"
    },
    {
      "question": "What is the main goal of unsupervised learning?",
      "options": ["Predicting continuous labels", "Finding hidden patterns in unlabeled data", "Classifying images into categories", "Minimizing prediction error on training sets"],
      "correctAnswer": "Finding hidden patterns in unlabeled data",
      "topic": "Unsupervised Learning",
      "difficulty": "Easy"
    },
    {
      "question": "What does a Decision Tree use to make splits at nodes?",
      "options": ["Gradient Descent", "Information Gain or Gini Impurity", "Euclidean Distance", "Kernel Trick"],
      "correctAnswer": "Information Gain or Gini Impurity",
      "topic": "Decision Trees",
      "difficulty": "Medium"
    },
    {
      "question": "Which validation technique splits data into k equal parts to evaluate performance?",
      "options": ["Holdout method", "K-fold cross-validation", "Bootstrap sampling", "Random split"],
      "correctAnswer": "K-fold cross-validation",
      "topic": "Model Evaluation",
      "difficulty": "Medium"
    },
    {
      "question": "Which of the following is a clustering algorithm?",
      "options": ["Random Forest", "Support Vector Machines", "K-Means", "Linear Discriminant Analysis"],
      "correctAnswer": "K-Means",
      "topic": "Clustering",
      "difficulty": "Easy"
    },
    {
      "question": "What is overfitting in a Machine Learning model?",
      "options": ["High training error, high test error", "Low training error, low test error", "Low training error, high test error", "High training error, low test error"],
      "correctAnswer": "Low training error, high test error",
      "topic": "Model Evaluation",
      "difficulty": "Medium"
    },
    {
      "question": "Which activation function is commonly used in the output layer of a binary classifier?",
      "options": ["ReLU", "Tanh", "Sigmoid", "Softmax"],
      "correctAnswer": "Sigmoid",
      "topic": "Classification",
      "difficulty": "Easy"
    },
    {
      "question": "What is the purpose of L1 regularization (Lasso)?",
      "options": ["Encourage coefficients to be exactly zero (sparsity)", "Prevent weights from growing too large without setting them to zero", "Increase training speed", "Allow non-linear classification"],
      "correctAnswer": "Encourage coefficients to be exactly zero (sparsity)",
      "topic": "Regression",
      "difficulty": "Hard"
    },
    {
      "question": "In support vector machines, what is the 'kernel trick' used for?",
      "options": ["To speed up linear classification", "To map data into a higher-dimensional space where it is linearly separable", "To reduce the number of support vectors", "To handle missing data features"],
      "correctAnswer": "To map data into a higher-dimensional space where it is linearly separable",
      "topic": "Classification",
      "difficulty": "Hard"
    },
    {
      "question": "Which metric is most appropriate for evaluating a classifier on a highly imbalanced dataset?",
      "options": ["Accuracy", "F1-Score", "Mean Squared Error", "R-Squared"],
      "correctAnswer": "F1-Score",
      "topic": "Model Evaluation",
      "difficulty": "Hard"
    }
  ],
  "web development": [
    {
      "question": "What does HTML stand for?",
      "options": ["Hyper Text Markup Language", "Home Tool Markup Language", "Hyperlinks and Text Markup Language", "Hyper Tool Multi Language"],
      "correctAnswer": "Hyper Text Markup Language",
      "topic": "HTML",
      "difficulty": "Easy"
    },
    {
      "question": "Which CSS property is used to change the text color of an element?",
      "options": ["font-color", "color", "text-color", "background-color"],
      "correctAnswer": "color",
      "topic": "CSS",
      "difficulty": "Easy"
    },
    {
      "question": "Which of the following is correct about JavaScript variables?",
      "options": ["var is block-scoped, let is function-scoped", "let and const are block-scoped, var is function-scoped", "const allows reassignment of values", "let variables cannot be reassigned"],
      "correctAnswer": "let and const are block-scoped, var is function-scoped",
      "topic": "JavaScript",
      "difficulty": "Medium"
    },
    {
      "question": "What is the DOM in web development?",
      "options": ["Data Object Model", "Document Object Model", "Domain Outline Management", "Document Oriented Middleware"],
      "correctAnswer": "Document Object Model",
      "topic": "DOM",
      "difficulty": "Easy"
    },
    {
      "question": "Which HTTP method is typically used to update an existing resource on the server?",
      "options": ["GET", "POST", "PUT", "DELETE"],
      "correctAnswer": "PUT",
      "topic": "HTTP",
      "difficulty": "Medium"
    },
    {
      "question": "What is the purpose of the 'useEffect' hook in React?",
      "options": ["To perform side effects in functional components", "To store global state variables", "To speed up component rendering", "To bind form inputs directly to variables"],
      "correctAnswer": "To perform side effects in functional components",
      "topic": "Web fundamentals",
      "difficulty": "Medium"
    },
    {
      "question": "What does a status code of 404 signify in HTTP?",
      "options": ["Success / OK", "Internal Server Error", "Resource Not Found", "Unauthorized Access"],
      "correctAnswer": "Resource Not Found",
      "topic": "HTTP",
      "difficulty": "Easy"
    },
    {
      "question": "What is the difference between client-side rendering (CSR) and server-side rendering (SSR)?",
      "options": ["CSR renders HTML on server, SSR renders in browser", "CSR renders HTML in browser, SSR renders on server", "CSR does not support JavaScript", "SSR only works with database connections"],
      "correctAnswer": "CSR renders HTML in browser, SSR renders on server",
      "topic": "Web fundamentals",
      "difficulty": "Hard"
    },
    {
      "question": "Which of the following describes cross-site scripting (XSS)?",
      "options": ["Injecting malicious scripts into trusted websites", "Stealing passwords by intercepting database traffic", "Flooding a server with fake requests to cause a crash", "Intercepting session cookies during transit"],
      "correctAnswer": "Injecting malicious scripts into trusted websites",
      "topic": "APIs",
      "difficulty": "Hard"
    },
    {
      "question": "What is the purpose of CORS in web applications?",
      "options": ["To compress image resources on transmission", "To allow or restrict requested resources on a web server from another domain", "To encrypt database connections between servers", "To define grid structures in CSS style sheets"],
      "correctAnswer": "To allow or restrict requested resources on a web server from another domain",
      "topic": "APIs",
      "difficulty": "Hard"
    }
  ],
  "physics": [
    {
      "question": "What is the SI unit of electric charge?",
      "options": ["Volt", "Ampere", "Coulomb", "Ohm"],
      "correctAnswer": "Coulomb",
      "topic": "Electrostatics",
      "difficulty": "Easy"
    },
    {
      "question": "According to Newton's Second Law, force is proportional to which of the following?",
      "options": ["Mass × Velocity", "Mass × Acceleration", "Velocity ÷ Time", "Momentum × Acceleration"],
      "correctAnswer": "Mass × Acceleration",
      "topic": "Mechanics",
      "difficulty": "Easy"
    },
    {
      "question": "What phenomenon occurs when light bends as it passes from one medium to another?",
      "options": ["Reflection", "Refraction", "Diffraction", "Polarization"],
      "correctAnswer": "Refraction",
      "topic": "Optics",
      "difficulty": "Easy"
    },
    {
      "question": "Which law states that the total current entering a junction equals the total current leaving it?",
      "options": ["Ohm's Law", "Kirchhoff's Current Law", "Faraday's Law", "Lenz's Law"],
      "correctAnswer": "Kirchhoff's Current Law",
      "topic": "Electrostatics",
      "difficulty": "Medium"
    },
    {
      "question": "What type of wave is sound in air?",
      "options": ["Transverse wave", "Longitudinal wave", "Electromagnetic wave", "Gravitational wave"],
      "correctAnswer": "Longitudinal wave",
      "topic": "Mechanics",
      "difficulty": "Easy"
    },
    {
      "question": "According to Einstein's photoelectric effect, what does the kinetic energy of emitted photoelectrons depend on?",
      "options": ["Intensity of incident light", "Frequency of incident light", "Surface area of the metal", "Duration of light exposure"],
      "correctAnswer": "Frequency of incident light",
      "topic": "Modern Physics",
      "difficulty": "Medium"
    },
    {
      "question": "What does the First Law of Thermodynamics represent?",
      "options": ["Conservation of momentum", "Conservation of energy", "Entropy increase", "Absolute zero temperature restriction"],
      "correctAnswer": "Conservation of energy",
      "topic": "Thermodynamics",
      "difficulty": "Medium"
    },
    {
      "question": "Which of the following fields are associated with electromagnetic induction?",
      "options": ["Only electric fields", "Only magnetic fields", "A changing magnetic field inducing an electric field", "A constant electric field inducing a magnetic field"],
      "correctAnswer": "A changing magnetic field inducing an electric field",
      "topic": "Magnetism",
      "difficulty": "Hard"
    },
    {
      "question": "What is the de Broglie wavelength of a particle of mass m moving with velocity v?",
      "options": ["h / mv", "mv / h", "hm / v", "hv / m"],
      "correctAnswer": "h / mv",
      "topic": "Modern Physics",
      "difficulty": "Hard"
    },
    {
      "question": "In a nuclear reactor, what is the function of a moderator?",
      "options": ["To absorb excess neutrons", "To slow down fast neutrons", "To speed up the fission reaction", "To cool the reactor core"],
      "correctAnswer": "To slow down fast neutrons",
      "topic": "Modern Physics",
      "difficulty": "Hard"
    }
  ],
  "general": [
    {
      "question": "What is the primary function of an Operating System?",
      "options": ["Word processing", "Resource management and user interface provider", "Database query execution", "Compiling programming code"],
      "correctAnswer": "Resource management and user interface provider",
      "topic": "Computer Science",
      "difficulty": "Easy"
    },
    {
      "question": "Which data structure operates on a Last-In, First-Out (LIFO) basis?",
      "options": ["Queue", "Stack", "Linked List", "Binary Tree"],
      "correctAnswer": "Stack",
      "topic": "Computer Science",
      "difficulty": "Easy"
    },
    {
      "question": "What does CPU stand for?",
      "options": ["Computer Processing Unit", "Central Processing Unit", "Core Processing Utility", "Central Program Unit"],
      "correctAnswer": "Central Processing Unit",
      "topic": "Computer Science",
      "difficulty": "Easy"
    },
    {
      "question": "Which protocol is the secure version of HTTP?",
      "options": ["FTP", "HTTPS", "SMTP", "SSH"],
      "correctAnswer": "HTTPS",
      "topic": "Computer Science",
      "difficulty": "Easy"
    },
    {
      "question": "Which binary number is equivalent to decimal value 10?",
      "options": ["1001", "1010", "1100", "0111"],
      "correctAnswer": "1010",
      "topic": "Mathematics",
      "difficulty": "Medium"
    },
    {
      "question": "What is the time complexity of searching in a balanced Binary Search Tree?",
      "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      "correctAnswer": "O(log n)",
      "topic": "Computer Science",
      "difficulty": "Medium"
    },
    {
      "question": "In relational databases, what does a primary key enforce?",
      "options": ["Data redundancy", "Entity integrity (uniqueness)", "Foreign key mapping", "Indexing speeds"],
      "correctAnswer": "Entity integrity (uniqueness)",
      "topic": "Computer Science",
      "difficulty": "Medium"
    },
    {
      "question": "What is the speed of light in vacuum?",
      "options": ["3 x 10^8 m/s", "3 x 10^6 m/s", "1.5 x 10^8 m/s", "3 x 10^10 m/s"],
      "correctAnswer": "3 x 10^8 m/s",
      "topic": "Physics",
      "difficulty": "Easy"
    },
    {
      "question": "Which programming paradigm is Java primarily known for?",
      "options": ["Functional Programming", "Object-Oriented Programming", "Logic Programming", "Procedural Programming"],
      "correctAnswer": "Object-Oriented Programming",
      "topic": "Computer Science",
      "difficulty": "Easy"
    },
    {
      "question": "What is the value of Euler's number (e) approximately?",
      "options": ["3.141", "2.718", "1.414", "1.618"],
      "correctAnswer": "2.718",
      "topic": "Mathematics",
      "difficulty": "Medium"
    }
  ]
};

// Shuffling helper
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function QuizPage({ quizSettings, setQuizResult }) {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [allocatedTimeSec, setAllocatedTimeSec] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const studentName = localStorage.getItem('studentName');
  const currentCourse = localStorage.getItem('currentCourse');
  const interestedCourse = localStorage.getItem('interestedCourse');

  // Normalizes MCQ question options and maps label-based answers to text strings
  const processAndRandomize = (rawQuestions) => {
    return rawQuestions.map(q => {
      if (quizSettings.type === 'MCQ' && q.options) {
        const opts = Array.isArray(q.options) ? q.options : Object.values(q.options);
        let correctVal = q.correctAnswer;
        
        // Handle character label correct answers (e.g. "A", "B", "C", "D")
        if (typeof q.correctAnswer === 'string' && q.correctAnswer.trim().length === 1) {
          const char = q.correctAnswer.trim().toUpperCase();
          const idx = char.charCodeAt(0) - 65;
          if (idx >= 0 && idx < opts.length) {
            correctVal = opts[idx];
          }
        }
        
        // Handle numeric index correct answers (e.g. 0, 1, 2, 3)
        if (typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < opts.length) {
          correctVal = opts[q.correctAnswer];
        }

        const shuffledOpts = shuffle(opts);

        return {
          ...q,
          options: shuffledOpts,
          correctAnswer: correctVal
        };
      }
      return q;
    });
  };

  // Resolves questions from the fallback question bank when the API fails
  const loadFallbackQuestions = () => {
    console.log("⚠️ Fallback bank triggered.");
    const fieldKey = (interestedCourse || "").toLowerCase().trim();
    
    // Select correct subject pool
    let pool = fallbackQuestionBank.general;
    if (fieldKey.includes("machine learning") || fieldKey.includes("ml") || fieldKey.includes("artificial intelligence") || fieldKey.includes("ai")) {
      pool = fallbackQuestionBank["machine learning"];
    } else if (fieldKey.includes("web") || fieldKey.includes("html") || fieldKey.includes("css") || fieldKey.includes("javascript")) {
      pool = fallbackQuestionBank["web development"];
    } else if (fieldKey.includes("physics")) {
      pool = fallbackQuestionBank.physics;
    }

    // Distribute difficulties based on count
    const totalCount = quizSettings.count || 10;
    let targetEasy = 0, targetMedium = 0, targetHard = 0;
    
    if (quizSettings.difficulty === 'Mixed') {
      if (totalCount === 10) {
        targetEasy = 3; targetMedium = 4; targetHard = 3;
      } else if (totalCount === 5) {
        targetEasy = 2; targetMedium = 2; targetHard = 1;
      } else {
        targetEasy = Math.round(totalCount * 0.3) || 1;
        targetHard = Math.round(totalCount * 0.3) || 1;
        targetMedium = totalCount - targetEasy - targetHard;
      }
    } else {
      // Single difficulty setting
      if (quizSettings.difficulty === 'Easy') targetEasy = totalCount;
      else if (quizSettings.difficulty === 'Hard') targetHard = totalCount;
      else targetMedium = totalCount;
    }

    // Filter pool into difficulty sub-lists
    const easyList = shuffle(pool.filter(q => q.difficulty === 'Easy'));
    const mediumList = shuffle(pool.filter(q => q.difficulty === 'Medium'));
    const hardList = shuffle(pool.filter(q => q.difficulty === 'Hard'));

    let selected = [];
    
    // Draw questions
    const draw = (list, count) => {
      const drawn = list.splice(0, count);
      selected = [...selected, ...drawn];
      return count - drawn.length; // return remaining needed
    };

    let needEasy = targetEasy;
    let needMedium = targetMedium;
    let needHard = targetHard;

    needEasy = draw(easyList, needEasy);
    needMedium = draw(mediumList, needMedium);
    needHard = draw(hardList, needHard);

    // If still need questions due to shallow pools, draw from remaining items
    const fallbackPool = shuffle([...easyList, ...mediumList, ...hardList]);
    draw(fallbackPool, needEasy + needMedium + needHard);

    // Finalize question structures
    const rawSelected = selected.slice(0, totalCount).map((q, idx) => ({
      id: `fallback-${fieldKey.replace(/\s+/g, '-')}-${idx}`,
      ...q
    }));

    return shuffle(processAndRandomize(rawSelected));
  };

  useEffect(() => {
    if (!studentName || !quizSettings) {
      navigate('/');
      return;
    }

    const fetchQuestions = async () => {
      try {
        const payload = {
          name: studentName,
          currentCourse: currentCourse,
          interestedCourse: interestedCourse,
          subject: quizSettings.subject,
          difficulty: quizSettings.difficulty,
          count: quizSettings.count,
          type: quizSettings.type
        };

        const res = await axios.post('http://localhost:5000/api/generate-questions', payload);
        if (res.data.success && Array.isArray(res.data.questions) && res.data.questions.length > 0) {
          const randomized = shuffle(processAndRandomize(res.data.questions));
          const durationSec = (Number(quizSettings.count) > 0 ? Number(quizSettings.count) : randomized.length) * 60;
          setQuestions(randomized);
          setAllocatedTimeSec(durationSec);
          setTimeLeft(durationSec);
          setLoading(false);
        } else {
          throw new Error("Invalid question format from server");
        }
      } catch (err) {
        console.error("API Fetch Failed, loading fallback bank:", err);
        const resolved = loadFallbackQuestions();
        const durationSec = (Number(quizSettings.count) > 0 ? Number(quizSettings.count) : resolved.length) * 60;
        setQuestions(resolved);
        setAllocatedTimeSec(durationSec);
        setTimeLeft(durationSec);
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [studentName, currentCourse, interestedCourse, quizSettings, navigate]);

  useEffect(() => {
    if (questions && questions.length > 0) {
      window.testQuestions = questions;
    }
  }, [questions]);

  useEffect(() => {
    if (!loading && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !loading) {
      handleSubmit(true); // Auto-submit on timeout (skips confirmation prompt)
    }
  }, [loading, timeLeft]);

  const handleAnswer = (val) => {
    setAnswers({ ...answers, [currentIndex]: val });
  };

  const handleSubmit = async (isTimeout = false) => {
    if (submitting) return;
    const timedOut = isTimeout === true;

    const answeredCount = questions.reduce((count, _, idx) => {
      const val = answers[idx];
      return count + (val !== undefined && val !== null && String(val).trim() !== '' ? 1 : 0);
    }, 0);
    const unansweredCount = Math.max(0, questions.length - answeredCount);

    // Check for unanswered questions (only check if NOT a timeout)
    if (!timedOut && unansweredCount > 0) {
      const confirmSubmit = window.confirm(`You have ${unansweredCount} unanswered questions. Are you sure you want to submit?`);
      if (!confirmSubmit) return;
    }

    setSubmitting(true);

    const baseAllocatedSec = allocatedTimeSec > 0
      ? allocatedTimeSec
      : (Number(quizSettings.count) > 0 ? Number(quizSettings.count) : questions.length) * 60;
    const timeTakenSec = timedOut
      ? baseAllocatedSec
      : Math.max(0, Math.min(baseAllocatedSec, baseAllocatedSec - timeLeft));

    let score = 0;
    const questionReview = [];
    const topicPerformanceMap = {};
    const difficultyPerformanceMap = {};

    questions.forEach((q, i) => {
      const userAns = answers[i];
      let isCorrect = false;
      let userAnsText = '';

      if (quizSettings.type === 'Numerical') {
        userAnsText = userAns !== undefined ? String(userAns).trim() : '';
        if (userAns !== undefined && userAns !== '' && Number(userAns) === Number(q.correctAnswer)) {
          isCorrect = true;
        }
      } else {
        const opts = Array.isArray(q.options) ? q.options : Object.values(q.options);
        if (userAns !== undefined && userAns !== null && userAns !== '') {
          userAnsText = opts[userAns] || '';
          const userStr = String(userAnsText).toLowerCase().trim();
          const correctStr = String(q.correctAnswer).toLowerCase().trim();
          if (userStr === correctStr) {
            isCorrect = true;
          }
        }
      }

      if (isCorrect) {
        score++;
      }

      // Add to questionReview
      questionReview.push({
        question: q.question,
        options: q.options || [],
        selectedAnswer: userAnsText,
        correctAnswer: String(q.correctAnswer),
        isCorrect: isCorrect,
        topic: q.topic || quizSettings.subject || 'General',
        difficulty: q.difficulty || quizSettings.difficulty || 'Medium',
        explanation: q.explanation || ''
      });

      // Topic Performance tracking
      const topicName = q.topic || quizSettings.subject || 'General';
      if (!topicPerformanceMap[topicName]) {
        topicPerformanceMap[topicName] = { topic: topicName, total: 0, correct: 0 };
      }
      topicPerformanceMap[topicName].total++;
      if (isCorrect) {
        topicPerformanceMap[topicName].correct++;
      }

      // Difficulty Performance tracking
      const diffLevel = q.difficulty || quizSettings.difficulty || 'Medium';
      if (!difficultyPerformanceMap[diffLevel]) {
        difficultyPerformanceMap[diffLevel] = { difficulty: diffLevel, total: 0, correct: 0 };
      }
      difficultyPerformanceMap[diffLevel].total++;
      if (isCorrect) {
        difficultyPerformanceMap[diffLevel].correct++;
      }
    });

    const totalQuestions = questions.length;
    const correctAnswers = score;
    const incorrectAnswers = totalQuestions - correctAnswers;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    const avgTimePerQuestion = totalQuestions > 0
      ? Number((timeTakenSec / totalQuestions).toFixed(2))
      : 0;

    // Convert performance maps to arrays and calculate accuracy
    const topicPerformance = Object.values(topicPerformanceMap).map(item => ({
      ...item,
      accuracy: item.total > 0 ? (item.correct / item.total) * 100 : 0
    }));

    const difficultyPerformance = Object.values(difficultyPerformanceMap).map(item => ({
      ...item,
      accuracy: item.total > 0 ? (item.correct / item.total) * 100 : 0
    }));

    // Categorize topics based on accuracy rules
    const strengths = [];
    const weakAreas = [];
    const averageAreas = [];

    topicPerformance.forEach(item => {
      if (item.accuracy >= 70) {
        strengths.push(item.topic);
      } else if (item.accuracy < 40) {
        weakAreas.push(item.topic);
      } else {
        averageAreas.push(item.topic);
      }
    });

    // Generate dynamic feedback
    let baseFeedback = "";
    if (accuracy >= 80) {
      baseFeedback = "Excellent performance! You have a strong understanding of the selected topics.";
    } else if (accuracy >= 60) {
      baseFeedback = "Good performance. You have a solid foundation, but some topics need additional practice.";
    } else {
      baseFeedback = "Your fundamentals need more practice. Focus on the weak topics before moving to advanced questions.";
    }

    let topicFeedback = "";
    if (topicPerformance.length > 0) {
      const sortedByAccuracy = [...topicPerformance].sort((a, b) => b.accuracy - a.accuracy);
      const strongest = sortedByAccuracy[0];
      const weakest = sortedByAccuracy[sortedByAccuracy.length - 1];
      if (strongest && weakest && strongest.topic !== weakest.topic) {
        topicFeedback = ` Your strongest area is ${strongest.topic}, while ${weakest.topic} needs more practice.`;
      } else if (strongest) {
        topicFeedback = ` Your primary topic is ${strongest.topic} with ${strongest.accuracy.toFixed(0)}% accuracy.`;
      }
    }
    const feedback = baseFeedback + topicFeedback;

    const attemptId = `attempt_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const resultPayload = {
      id: attemptId,
      attempt_id: attemptId,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      unansweredCount,
      score,
      accuracy,
      timeTakenSec,
      avgTimePerQuestion,
      quizDifficulty: quizSettings.difficulty,
      questionType: quizSettings.type,
      topicPerformance,
      difficultyPerformance,
      strengths,
      weakAreas,
      averageAreas,
      feedback,
      questionReview,
      subject: quizSettings.subject,
      studentName,
      currentCourse,
      interestedCourse
    };

    setQuizResult(resultPayload);
    navigate('/result');
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '100px' }}>
        <div className="spinner"></div>
        <h2 className="title mt-4">Preparing your personalized quiz...</h2>
        <p>Designing practical {quizSettings?.subject} questions aligned with your course ({currentCourse}) and interested field.</p>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="container">
      <div className="card">
        {/* Student metadata panel */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '15px', 
          background: '#f8fafc', 
          padding: '15px', 
          borderRadius: '12px', 
          marginBottom: '1.5rem',
          border: '1px solid var(--border)',
          fontSize: '0.9rem'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Student:</span>{' '}
            <strong style={{ color: 'var(--text-main)' }}>{studentName}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Course:</span>{' '}
            <strong style={{ color: 'var(--text-main)' }}>{currentCourse}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Interested Field:</span>{' '}
            <strong style={{ color: 'var(--text-main)' }}>{interestedCourse}</strong>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ 
              background: currentQ.difficulty === 'Easy' ? '#d1fae5' : currentQ.difficulty === 'Hard' ? '#fee2e2' : '#fef3c7',
              color: currentQ.difficulty === 'Easy' ? '#065f46' : currentQ.difficulty === 'Hard' ? '#991b1b' : '#92400e',
              padding: '4px 10px',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.8rem'
            }}>
              {currentQ.difficulty || quizSettings.difficulty}
            </span>
            {currentQ.topic && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Topic: <b>{currentQ.topic}</b>
              </span>
            )}
          </div>
          <div style={{ color: 'var(--danger)', fontWeight: 'bold', background: '#fee2e2', padding: '5px 15px', borderRadius: '20px', fontSize: '0.9rem' }}>
            Time Left: {mins < 10 ? '0'+mins : mins}:{secs < 10 ? '0'+secs : secs}
          </div>
        </div>

        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginBottom: '2rem' }}>
          <div style={{ width: `${((currentIndex + 1) / questions.length) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }}></div>
        </div>

        <h3 className="mb-4">Q{currentIndex + 1}. {currentQ.question}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {quizSettings.type === 'Numerical' ? (
            <input 
              type="number" 
              className="form-control" 
              placeholder="Enter numeric value"
              value={answers[currentIndex] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
            />
          ) : (
            (Array.isArray(currentQ.options) ? currentQ.options : Object.values(currentQ.options)).map((opt, i) => (
              <label 
                key={i} 
                style={{ 
                  display: 'block', padding: '15px', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
                  background: answers[currentIndex] === i ? '#eff6ff' : 'white',
                  borderColor: answers[currentIndex] === i ? 'var(--primary)' : 'var(--border)'
                }}
              >
                <input 
                  type="radio" 
                  name="mcq" 
                  value={i} 
                  checked={answers[currentIndex] === i}
                  onChange={() => handleAnswer(i)} 
                  style={{ marginRight: '10px' }}
                />
                {opt}
              </label>
            ))
          )}
        </div>

        <div className="flex justify-between mt-8 items-center">
          <button 
            className="btn btn-secondary" 
            style={{ width: 'auto' }}
            disabled={currentIndex === 0} 
            onClick={() => setCurrentIndex(prev => prev - 1)}
          >
            Previous
          </button>
          <span>{currentIndex + 1} / {questions.length}</span>
          {currentIndex === questions.length - 1 ? (
            <button className="btn btn-success" style={{ width: 'auto' }} onClick={() => handleSubmit(false)}>Submit Quiz</button>
          ) : (
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setCurrentIndex(prev => prev + 1)}>Next</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuizPage;
