const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "admin") {
    window.location.href = "login.html";
}

function logoutAdmin() {
    localStorage.clear();
    window.location.href = "login.html";
}

// Tab Switching
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');

    if(tabId === 'courses') loadCourses();
    if(tabId === 'subjects') loadCoursesForSelect('courseSelectForSubject');
    if(tabId === 'questions') {
        loadCoursesForSelect('qCourseSelect');
        loadQuestions();
    }
    if(tabId === 'results') loadResults();
}

const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
};

// --- Courses ---
async function loadCourses() {
    try {
        const res = await fetch("http://localhost:5000/api/courses");
        const data = await res.json();
        const list = document.getElementById("courseList");
        list.innerHTML = "";
        data.courses.forEach(c => {
            list.innerHTML += `<li>${c.name}</li>`;
        });
    } catch (err) { console.error(err); }
}

async function addCourse(e) {
    e.preventDefault();
    const name = document.getElementById("newCourseName").value;
    try {
        const res = await fetch("http://localhost:5000/api/courses", {
            method: "POST", headers, body: JSON.stringify({ name })
        });
        if(res.ok) { alert("Course added"); loadCourses(); }
    } catch (err) { console.error(err); }
}

// --- Subjects ---
async function loadCoursesForSelect(selectId) {
    try {
        const res = await fetch("http://localhost:5000/api/courses");
        const data = await res.json();
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select Course</option>';
        data.courses.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    } catch (err) { console.error(err); }
}

async function addSubject(e) {
    e.preventDefault();
    const courseId = document.getElementById("courseSelectForSubject").value;
    const name = document.getElementById("newSubjectName").value;
    try {
        const res = await fetch("http://localhost:5000/api/subjects", {
            method: "POST", headers, body: JSON.stringify({ courseId, name })
        });
        if(res.ok) { alert("Subject added"); document.getElementById("newSubjectName").value=""; }
    } catch (err) { console.error(err); }
}

// --- Questions ---
async function fetchSubjectsForAdmin(courseId) {
    try {
        const res = await fetch(`http://localhost:5000/api/subjects/${courseId}`);
        const data = await res.json();
        const select = document.getElementById("qSubjectSelect");
        select.innerHTML = '<option value="">Select Subject</option>';
        data.subjects.forEach(s => {
            select.innerHTML += `<option value="${s.name}">${s.name}</option>`;
        });
    } catch (err) { console.error(err); }
}

function toggleOptions(type) {
    const mcqDiv = document.getElementById("mcqOptions");
    mcqDiv.style.display = type === "MCQ" ? "block" : "none";
}

async function addQuestion(e) {
    e.preventDefault();
    const courseSelect = document.getElementById("qCourseSelect");
    const course = courseSelect.options[courseSelect.selectedIndex].text;
    const subject = document.getElementById("qSubjectSelect").value;
    const difficulty = document.getElementById("qDifficulty").value;
    const type = document.getElementById("qType").value;
    const text = document.getElementById("qText").value;
    const answer = document.getElementById("qAnswer").value;

    let options = {};
    if(type === "MCQ") {
        options = {
            "A": document.getElementById("optA").value,
            "B": document.getElementById("optB").value,
            "C": document.getElementById("optC").value,
            "D": document.getElementById("optD").value
        };
    }

    try {
        const res = await fetch("http://localhost:5000/api/admin/questions", {
            method: "POST", headers, 
            body: JSON.stringify({ course, subject, text, options, answer, difficulty, type })
        });
        if(res.ok) { 
            alert("Question added"); 
            document.getElementById("questionForm").reset();
            toggleOptions('');
            loadQuestions();
        }
    } catch (err) { console.error(err); }
}

async function loadQuestions() {
    try {
        const res = await fetch("http://localhost:5000/api/admin/questions", { headers });
        const data = await res.json();
        const tbody = document.getElementById("questionsBody");
        tbody.innerHTML = "";
        if (data.questions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No questions found.</td></tr>`;
            return;
        }
        data.questions.forEach(q => {
            tbody.innerHTML += `
                <tr>
                    <td>${q.course}</td>
                    <td>${q.subject}</td>
                    <td>${q.text.substring(0, 30)}...</td>
                    <td>${q.type}</td>
                    <td><button onclick="deleteQuestion(${q.id})" class="btn-danger">Delete</button></td>
                </tr>
            `;
        });
    } catch (err) { console.error(err); }
}

async function deleteQuestion(id) {
    if(!confirm("Are you sure?")) return;
    try {
        const res = await fetch(`http://localhost:5000/api/admin/questions/${id}`, {
            method: "DELETE", headers
        });
        if(res.ok) loadQuestions();
    } catch (err) { console.error(err); }
}

// --- Results ---
async function loadResults() {
    try {
        const res = await fetch("http://localhost:5000/api/results", { headers });
        const data = await res.json();
        const tbody = document.getElementById("resultsBody");
        tbody.innerHTML = "";
        
        if (data.results && data.results.length > 0) {
            data.results.forEach(result => {
                const date = new Date(result.created_at).toLocaleDateString();
                tbody.innerHTML += `
                    <tr>
                        <td>${result.name || result.email || 'Student'}</td>
                        <td>${result.currentCourse || result.course || 'N/A'}</td>
                        <td>${result.interestedCourse || result.subject || 'N/A'}</td>
                        <td>${result.score || 0}</td>
                        <td>${date}</td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No results found.</td></tr>`;
        }
    } catch (err) { console.error(err); }
}

// Initial Load
window.onload = loadCourses;
