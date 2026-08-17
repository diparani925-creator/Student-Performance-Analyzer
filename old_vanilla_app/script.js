let globalQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // To store user answers: { index: value }
let timerInterval;
let timeRemaining = 0;

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "student") {
    window.location.href = "login.html";
}

// Free text input implies no need to preload fixed courses from DB.

async function startQuiz(event) {
    event.preventDefault();
    const studentNameInput = document.getElementById("studentName").value.trim();
    const course = document.getElementById("currentCourse").value.trim();
    const subject = document.getElementById("interestedField").value.trim();
    
    if (!studentNameInput || !course || !subject) {
        alert("Please fill in all fields.");
        return;
    }
    const difficulty = document.getElementById("difficulty").value;
    const count = parseInt(document.getElementById("questionCount").value, 10);
    const type = document.getElementById("questionType").value;

    localStorage.setItem("selectedCourse", course);
    localStorage.setItem("selectedSubject", subject);
    localStorage.setItem("questionType", type);

    document.getElementById("quizSettings").style.display = "none";
    document.getElementById("loadingArea").style.display = "block";

    const name = studentNameInput || localStorage.getItem("userName") || "Student";
    localStorage.setItem("userName", name);

    try {
        const res = await fetch("http://localhost:5000/api/generate-questions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject: subject, difficulty, count, type, currentCourse: course, interestedCourse: subject })
        });

        if (!res.ok) throw new Error("Server Error");
        const data = await res.json();

        if (!data.success || !data.questions || data.questions.length === 0) {
            alert("Error generating questions. Please try again.");
            location.reload();
            return;
        }

        globalQuestions = data.questions;
        currentQuestionIndex = 0;
        userAnswers = {};

        document.getElementById("loadingArea").style.display = "none";
        document.getElementById("quizArea").style.display = "block";
        document.getElementById("courseTitle").innerText = `${subject} Quiz`;

        // 1 minute per question
        timeRemaining = count * 60; 
        startTimer();

        renderQuestion();
    } catch (err) {
        console.error(err);
        alert("Failed to connect to server.");
        location.reload();
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeRemaining--;
        let m = Math.floor(timeRemaining / 60);
        let s = timeRemaining % 60;
        document.getElementById("timerDisplay").innerText = `Time Left: ${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("Time's up! Submitting your test automatically.");
            calculateResult(new Event('submit'));
        }
    }, 1000);
}

function renderQuestion() {
    const qObj = globalQuestions[currentQuestionIndex];
    const type = localStorage.getItem("questionType");
    const qBox = document.getElementById("questionBox");

    let html = `<div class="question-container fade-in">
        <h4 style="margin-bottom: 20px;">Q${currentQuestionIndex + 1}: ${qObj.question}</h4>
    `;

    // Retrieve previous answer if any
    const savedAns = userAnswers[currentQuestionIndex] !== undefined ? userAnswers[currentQuestionIndex] : "";

    if (type === "Numerical") {
        html += `<input type="number" step="any" id="ansInput" class="form-control" placeholder="Enter numeric answer" value="${savedAns}" oninput="saveAnswer(this.value)">`;
    } else {
        const optionsArr = Array.isArray(qObj.options) ? qObj.options : Object.entries(qObj.options || {}).map(([k,v])=>v);
        optionsArr.forEach((opt, i) => {
            const checked = savedAns === i.toString() ? "checked" : "";
            html += `
                <label class="option-label" onclick="saveAnswer('${i}')">
                    <input type="radio" name="mcqAns" value="${i}" ${checked}> ${opt}
                </label>
            `;
        });
    }

    html += `</div>`;
    qBox.innerHTML = html;

    // Update Counter & Progress
    document.getElementById("questionCounter").innerText = `${currentQuestionIndex + 1} / ${globalQuestions.length}`;
    document.getElementById("progressBar").style.width = `${((currentQuestionIndex + 1) / globalQuestions.length) * 100}%`;

    // Toggle Buttons
    document.getElementById("prevBtn").disabled = currentQuestionIndex === 0;
    if (currentQuestionIndex === globalQuestions.length - 1) {
        document.getElementById("nextBtn").style.display = "none";
        document.getElementById("submitBtn").style.display = "inline-block";
    } else {
        document.getElementById("nextBtn").style.display = "inline-block";
        document.getElementById("submitBtn").style.display = "none";
    }
}

function saveAnswer(val) {
    userAnswers[currentQuestionIndex] = val;
}

function nextQuestion() {
    if (currentQuestionIndex < globalQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

async function calculateResult(e) {
    if(e) e.preventDefault();
    clearInterval(timerInterval);

    let score = 0;
    let wrongAns = 0;
    let wrongTopics = [];
    const type = localStorage.getItem("questionType");
    let resultHTML = "<h3>Detailed Review</h3>";

    globalQuestions.forEach((qObj, i) => {
        const userAns = userAnswers[i];
        let isCorrect = false;
        let userAnswerText = "<i>No answer selected</i>";
        const correctRaw = qObj.answer || qObj.correctAnswer;
        let correctDisplay = correctRaw;

        if (type === "Numerical") {
            if (userAns !== undefined && userAns !== "") {
                userAnswerText = userAns;
                isCorrect = Number(userAns) === Number(correctRaw);
            }
        } else {
            const optionsArr = Array.isArray(qObj.options) ? qObj.options : Object.values(qObj.options || {});
            if (userAns !== undefined && userAns !== "") {
                const optIndex = parseInt(userAns, 10);
                userAnswerText = optionsArr[optIndex];
                
                const label = String.fromCharCode(65 + optIndex);
                const ansStr = String(correctRaw).trim().toLowerCase();
                isCorrect = (ansStr === label.toLowerCase()) || 
                            (ansStr === String(userAnswerText).trim().toLowerCase()) ||
                            (ansStr === String(userAnswerText).replace(/^[A-D][\.\)]\s*/i, '').trim().toLowerCase());
            }
            if (String(correctRaw).length === 1 && /^[A-D]$/i.test(correctRaw)) {
                const idx = correctRaw.toUpperCase().charCodeAt(0) - 65;
                if (optionsArr[idx]) correctDisplay = optionsArr[idx];
            }
        }

        if (isCorrect) {
            score++;
        } else {
            wrongAns++;
            if (qObj.topic && !wrongTopics.includes(qObj.topic)) {
                wrongTopics.push(qObj.topic);
            }
        }

        const statusClass = isCorrect ? "text-success" : "text-danger";
        const statusText = isCorrect ? "Correct" : "Incorrect";

        resultHTML += `
            <div class="result-item mt-20 p-15" style="border: 1px solid #ddd; border-radius: 8px;">
                <p><b>Q${i + 1}:</b> ${qObj.question}</p>
                <p><b>Your Answer:</b> <span class="${statusClass}">${userAnswerText}</span></p>
                <p><b>Correct Answer:</b> ${correctDisplay}</p>
                ${qObj.explanation ? `<p class="mt-10" style="font-size:14px; color:#555;"><b>Explanation:</b> ${qObj.explanation}</p>` : ""}
            </div>
        `;
    });

    const total = globalQuestions.length;
    const percentage = (score / total) * 100;
    const weakAreas = percentage < 50 ? localStorage.getItem("selectedSubject") : "None";
    const feedback = percentage >= 80 ? "Excellent Performance!" : percentage >= 50 ? "Good, but needs improvement." : "Poor performance. Needs deep focus.";

    const resultBox = document.getElementById("resultBox");
    resultBox.innerHTML = `
        <h2 class="text-center">Quiz Analysis</h2>
        <div class="stats-row mt-20" style="display:flex; justify-content:space-around; text-align:center;">
            <div><h3>${total}</h3><p>Total</p></div>
            <div><h3 class="text-success">${score}</h3><p>Correct</p></div>
            <div><h3 class="text-danger">${wrongAns}</h3><p>Wrong</p></div>
            <div><h3 style="color:#007bff">${percentage.toFixed(0)}%</h3><p>Score</p></div>
        </div>

        <div class="charts-container mt-20" style="display:flex; justify-content:center; gap: 30px; flex-wrap:wrap;">
            <div style="width: 300px; height: 300px;">
                <canvas id="doughnutChart"></canvas>
            </div>
            <div style="width: 400px; height: 300px;">
                <canvas id="barChart"></canvas>
            </div>
        </div>

        <div id="aiFeedbackBox" class="mt-20 p-15" style="background: #f8f9fa; border-radius: 8px;">
            <div class="text-center"><div class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block;"></div><span style="margin-left:10px;">AI is generating personalized feedback...</span></div>
        </div>

        ${resultHTML}
        
        <div class="text-center mt-20">
            <button class="btn-primary" onclick="location.reload()">Take Another Quiz</button>
            <button class="btn-secondary" onclick="window.location.href='result.html'">View History</button>
        </div>
    `;

    document.getElementById("quizArea").style.display = "none";
    resultBox.style.display = "block";

    // Render Charts
    const ctxDoughnut = document.getElementById('doughnutChart').getContext('2d');
    new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: ['Correct', 'Wrong'],
            datasets: [{
                data: [score, wrongAns],
                backgroundColor: ['#28a745', '#dc3545']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxBar = document.getElementById('barChart').getContext('2d');
    new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: ['Score', 'Lost'],
            datasets: [{
                label: 'Points',
                data: [score, wrongAns],
                backgroundColor: ['#007bff', '#dc3545']
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: total } }
        }
    });

    // AI Performance Analysis and Save to backend
    const name = localStorage.getItem("userName") || localStorage.getItem("email") || "Student";
    const course = localStorage.getItem("selectedCourse");
    const subject = localStorage.getItem("selectedSubject");

    try {
        const aiRes = await fetch("http://localhost:5000/api/analyze-performance", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wrongTopics: wrongTopics.length ? wrongTopics : ["None"], subject, currentCourse: course, interestedCourse: subject })
        });
        const aiData = await aiRes.json();
        
        let finalWeakAreas = weakAreas;
        let finalFeedback = feedback;

        if (aiData.success && aiData.analysis) {
            const fbBox = document.getElementById("aiFeedbackBox");
            fbBox.innerHTML = `
                <h3 style="color: #4F46E5;">AI Insights & Recommendations</h3>
                <p><b>Strengths:</b> ${aiData.analysis.strengths.join(", ")}</p>
                <p><b>Weak Areas to focus:</b> <span class="text-danger">${aiData.analysis.weakTopics.join(", ")}</span></p>
                <div style="margin-top: 10px;"><b>Suggestions:</b><ul>${aiData.analysis.suggestions.map(s => `<li>${s}</li>`).join("")}</ul></div>
                <p style="margin-top: 10px; white-space: pre-wrap;"><b>Study Plan:</b><br>${aiData.analysis.studyPlan}</p>
            `;
            finalWeakAreas = aiData.analysis.weakTopics.join(", ");
            finalFeedback = aiData.analysis.studyPlan;
        } else {
            document.getElementById("aiFeedbackBox").innerHTML = `<p>${feedback}</p><p><b>Weak Areas to focus:</b> ${weakAreas}</p>`;
        }

        await fetch("http://localhost:5000/api/evaluate", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ 
                name, course, subject, score, 
                total_questions: total, 
                correct_answers: score, 
                wrong_answers: wrongAns, 
                weak_areas: finalWeakAreas, 
                feedback: finalFeedback 
            })
        });
    } catch (err) { 
        console.error("Failed to analyze/save result", err); 
        document.getElementById("aiFeedbackBox").innerHTML = `<p>${feedback}</p><p><b>Weak Areas to focus:</b> ${weakAreas}</p>`;
    }
}