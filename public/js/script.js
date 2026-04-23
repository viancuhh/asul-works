// ==========================================
// WORKER MODULE (Database Connected)
// ==========================================

// Global state to hold fetched data for fast filtering
let activeJobs = []; 
let workerApps = [];
const API_URL = 'http://localhost:3000/api';

// --- PAGE ROUTER & INITIALIZER ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    // Auth Check
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!path.includes('index.html') && path !== '/' && !isLoggedIn) {
        window.location.href = 'index.html';
        return;
    }

    if (path.includes('workerdashboard.html')) {
        document.getElementById('nav-dashboard').classList.add('active');
        loadJobsFromDatabase();
    } else if (path.includes('jobdetails.html')) {
        initJobDetails();
    } else if (path.includes('applicationform.html')) {
        initApplicationForm();
    } else if (path.includes('applicationtracking.html')) {
        document.getElementById('nav-tracking').classList.add('active');
        loadTrackingFromDatabase();
    }
});

// --- API FETCH FUNCTIONS ---

async function loadJobsFromDatabase() {
    try {
        const response = await fetch(`${API_URL}/jobs`); 
        activeJobs = await response.json();
        
        // Only show approved jobs to workers
        const approvedJobs = activeJobs.filter(j => j.Status === 'Approved');
        renderJobs(approvedJobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        document.getElementById('job-listings-container').innerHTML = '<p class="text-center text-danger">Failed to load jobs from the database.</p>';
    }
}

// --- TRACKING LOGIC ---
async function loadTrackingFromDatabase() {
    try {
        const response = await fetch(`${API_URL}/applications`); 
        const allApps = await response.json();
        
        const currentWorkerId = localStorage.getItem('userId');
        
        // 🔍 DEBUGGING LOGS (Check your browser console!)
        console.log("Logged In Worker ID:", currentWorkerId);
        console.log("All Applications in DB:", allApps);
        
        // Filter applications to ONLY show the ones belonging to the logged-in worker
        workerApps = allApps.filter(app => String(app.WorkerID) === String(currentWorkerId));
        
        console.log("Filtered Applications showing on screen:", workerApps);
        
        renderTracking(workerApps);
    } catch (error) {
        console.error('Error fetching applications:', error);
    }
}



// --- AUTH LOGIC ---
function toggleAuth() {
    document.getElementById('login-section').classList.toggle('hidden');
    document.getElementById('register-section').classList.toggle('hidden');
    
    // Clear forms when toggling
    document.querySelectorAll('form').forEach(form => form.reset());
}

async function handleAuth(event, type) {
    event.preventDefault();
    const role = type === 'login' ? document.getElementById('loginRole').value : 'Worker';
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save state to frontend local storage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userRole', data.user.Role);
            localStorage.setItem('userId', data.user.UserID);
            localStorage.setItem('userName', data.user.FirstName);
            
            alert(`Welcome back, ${data.user.FirstName}!`);
            
            // Redirect based on role
            if (data.user.Role === 'Worker') window.location.href = 'workerdashboard.html';
            else if (data.user.Role === 'Employer') window.location.href = 'employerdashboard.html';
            else if (data.user.Role === 'Admin') window.location.href = 'admindashboard.html';
        } else {
            alert(data.error || 'Login failed. Please check your credentials.');
        }
    } catch (error) {
        console.error('Login Error:', error);
        alert('Failed to connect to the server. Is it running?');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const pass1 = document.getElementById('regPass').value;
    const pass2 = document.getElementById('regPassConfirm').value;
    
    if (pass1 !== pass2) {
        alert("Passwords do not match. Please try again.");
        return;
    }

    const userData = {
        firstName: document.getElementById('regFName').value,
        lastName: document.getElementById('regLName').value,
        mi: document.getElementById('regMI').value,
        dob: document.getElementById('regDOB').value,
        contact: document.getElementById('regContact').value,
        address: document.getElementById('regAddress').value,
        email: document.getElementById('regEmail').value,
        password: pass1
    };

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok) {
            alert('Registration successful! You can now log in.');
            toggleAuth(); // Switch back to login page
        } else {
            alert(data.error || 'Registration failed.');
        }
    } catch (error) {
        console.error('Registration Error:', error);
        alert('Failed to connect to the server. Is it running?');
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// --- DASHBOARD LOGIC ---
function renderJobs(jobsList) {
    const container = document.getElementById('job-listings-container');
    if (!container) return; // Prevent error if not on dashboard
    
    container.innerHTML = '';
    if(jobsList.length === 0) return container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No jobs found.</p>';

    jobsList.forEach(job => {
        container.innerHTML += `
            <div class="job-card">
                <div class="job-card-title">${job.JobTitle}</div>
                <div class="job-card-meta">📍 ${job.Location} <br>💰 ${job.DailyWage} PHP / Day</div>
                <div style="margin-bottom: 1.5rem;"><span class="tag">${job.JobType}</span></div>
                <button class="btn btn-outline" onclick="openJobDetails(${job.JobID})">View Details</button>
            </div>
        `;
    });
}

function filterJobs() {
    const search = document.getElementById('searchTitle').value.toLowerCase();
    const type = document.getElementById('filterType').value;
    const wage = document.getElementById('filterWage').value;

    let filtered = activeJobs.filter(job => {
        if(job.Status !== 'Approved') return false;

        const matchSearch = job.JobTitle.toLowerCase().includes(search);
        const matchType = type === 'All' || job.JobType === type;
        
        let matchWage = true;
        const wageVal = parseFloat(job.DailyWage);
        if(wage === 'Below700') matchWage = wageVal < 700;
        else if(wage === 'Exact700') matchWage = wageVal === 700;
        else if(wage === 'Above700') matchWage = wageVal > 700;
        
        return matchSearch && matchType && matchWage;
    });
    renderJobs(filtered);
}

function openJobDetails(jobId) {
    localStorage.setItem('activeJobId', jobId);
    window.location.href = 'jobdetails.html';
}

// --- JOB DETAILS LOGIC ---
async function initJobDetails() {
    const jobId = localStorage.getItem('activeJobId');
    if(!jobId) return window.location.href = 'workerdashboard.html';

    try {
        const response = await fetch(`${API_URL}/jobs/${jobId}`);
        const job = await response.json();
        
        const container = document.getElementById('job-details-content');
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                <div><h1 style="margin-bottom: 0.5rem;">${job.JobTitle}</h1><span class="tag">${job.JobType}</span></div>
                <button class="btn" style="width: auto;" onclick="window.location.href='applicationform.html'">Apply for this Job</button>
            </div>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin-bottom: 1.5rem;">
            <div class="form-row mb-2">
                <div style="flex: 1;"><strong>📍 Location:</strong> ${job.Location}</div>
                <div style="flex: 1;"><strong>💰 Daily Wage:</strong> ${job.DailyWage} PHP</div>
                <div style="flex: 1;"><strong>⏰ Schedule:</strong> ${job.Schedule}</div>
            </div>
            <h3 class="mb-1">Required Skills</h3><p class="mb-2">${job.RequiredSkills}</p>
            <h3 class="mb-1">Job Description</h3><p>${job.JobDescription}</p>
        `;
    } catch (err) {
        console.error(err);
    }
}

async function initApplicationForm() {
    const jobId = localStorage.getItem('activeJobId');
    const userId = localStorage.getItem('userId');
    
    if(!jobId || !userId) {
        console.warn("Missing jobId or userId in localStorage. Please log out and log back in.");
        return;
    }

    try {
        // 1. Fetch Job Title
        const jobRes = await fetch(`${API_URL}/jobs/${jobId}`);
        if(jobRes.ok) {
            const job = await jobRes.json();
            const titleElement = document.getElementById('apply-job-title');
            if (titleElement) titleElement.innerText = job.JobTitle;
        }

        // 2. Fetch User Details to pre-fill the form
        const userRes = await fetch(`${API_URL}/users/${userId}`);
        if (userRes.ok) {
            const user = await userRes.json();

            let formattedDOB = '';
            if (user.DateOfBirth) {
                const d = new Date(user.DateOfBirth);
                formattedDOB = d.toISOString().split('T')[0]; 
            }

            document.getElementById('prefName').value = `${user.FirstName || ''} ${user.MiddleInitial ? user.MiddleInitial + '.' : ''} ${user.LastName || ''}`.trim();
            document.getElementById('prefDOB').value = formattedDOB;
            document.getElementById('prefEmail').value = user.Email || '';
            document.getElementById('prefContact').value = user.ContactNumber || '';
            document.getElementById('prefAddress').value = user.Address || '';
            
        } else {
            console.error("Failed to fetch user data for pre-fill. Check server.js route.");
        }

    } catch (err) {
        console.error("Error initializing application form:", err);
    }
}

async function submitApplication(event) {
    event.preventDefault();
    const jobId = localStorage.getItem('activeJobId');
    const workerId = localStorage.getItem('userId');

    const formData = new FormData();
    formData.append('jobId', jobId);
    formData.append('workerId', workerId);
    formData.append('pitch', document.getElementById('appPitch').value);
    formData.append('education', document.getElementById('appEducation').value);
    formData.append('school', document.getElementById('appSchool').value);
    formData.append('degree', document.getElementById('appDegree').value);
    formData.append('skills', document.getElementById('appSkills').value);
    formData.append('certs', document.getElementById('appCerts').value);
    formData.append('startDate', document.getElementById('appStartDate').value);
    
    // Append the file
    const resumeFile = document.getElementById('appResume').files[0];
    if (resumeFile) {
        formData.append('resume', resumeFile);
    }

    try {
        const response = await fetch(`${API_URL}/applications`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if(response.ok) {
            alert('Application submitted successfully!');
            window.location.href = 'applicationtracking.html';
        } else {
            alert(data.message || 'Error submitting application.');
        }
    } catch (err) {
        console.error('Submission failed:', err);
        alert('Server communication error.');
    }
}


// --- TRACKING LOGIC ---
function renderTracking(appsList) {
    const tbody = document.getElementById('tracking-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if(appsList.length === 0) {
        return tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem;">No applications found. Try submitting one!</td></tr>';
    }

    appsList.forEach(app => {
        let statusClass = app.Status === 'Pending' ? 'status-pending' : (app.Status === 'Accepted' ? 'status-accepted' : 'status-declined');
        let actionHtml = '-';
        
        if (app.Status === 'Accepted' && app.WorkerResponse === 'Pending') {
            actionHtml = `<button class="btn btn-success btn-small" onclick="respondOffer(${app.ApplicationID}, 'Accepted Offer')">Accept</button>
                          <button class="btn btn-danger btn-small" onclick="respondOffer(${app.ApplicationID}, 'Declined Offer')" style="margin-top: 5px;">Decline</button>`;
        } else if (app.WorkerResponse !== 'Pending' && app.WorkerResponse !== 'N/A') {
            actionHtml = `<strong style="color: var(--primary-blue);">${app.WorkerResponse}</strong>`;
        }
        
        // Formats the Start Date safely
        let startDate = 'N/A';
        if (app.EarliestStartDate) {
            startDate = new Date(app.EarliestStartDate).toLocaleDateString();
        }
        
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: bold; color: var(--primary-blue);">${app.JobTitle || 'Job #' + app.JobID}</td>
                <td>${app.Location || 'N/A'}</td>
                <td>Starts: ${startDate}</td>
                <td><span class="status-badge ${statusClass}">${app.Status}</span></td>
                <td>${actionHtml}</td>
            </tr>`;
    });
}

async function respondOffer(appId, responseText) {
    try {
        const response = await fetch(`${API_URL}/applications/${appId}/response`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workerResponse: responseText })
        });
        
        if(response.ok) {
            loadTrackingFromDatabase(); // Refresh the table
        }
    } catch (err) {
        console.error('Failed to respond to offer:', err);
    }
}
