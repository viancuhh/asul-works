// ==========================================
// EMPLOYER MODULE (Database Connected)
// ==========================================

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    if (path.includes('employerdashboard.html')) {
        initDashboard();
    } else if (path.includes('jobmanagement.html')) {
        loadEmployerJobs();
    } else if (path.includes('applicanttracking.html')) {
        loadApplicants();
    }
});

// --- DASHBOARD LOGIC ---
async function initDashboard() {
    try {
        const jobsRes = await fetch('/api/jobs'); 
        const jobs = await jobsRes.json();
        
        const appsRes = await fetch('/api/applications'); 
        const apps = await appsRes.json();

        const activeJobs = jobs.filter(j => j.Status === 'Approved').length;
        const pendingApps = apps.filter(a => a.Status === 'Pending').length;
        
        const statActive = document.getElementById('stat-active-jobs');
        const statPending = document.getElementById('stat-pending-apps');
        
        if(statActive) statActive.innerText = activeJobs;
        if(statPending) statPending.innerText = pendingApps;
    } catch (err) {
        console.error('Dashboard error:', err);
    }
}

// --- JOB MANAGEMENT LOGIC ---
async function handleCreateJob(event) {
    event.preventDefault();
    
    const newJob = {
        employerId: 1, 
        title: document.getElementById('jobTitle').value,
        wage: parseFloat(document.getElementById('jobWage').value),
        location: document.getElementById('jobLocation').value,
        type: document.getElementById('jobType').value,
        schedule: document.getElementById('jobSchedule').value,
        skills: document.getElementById('jobSkills').value,
        desc: document.getElementById('jobDesc').value
    };
    
    try {
        const response = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newJob)
        });

        if(response.ok) {
            event.target.reset();
            alert("Job Listing submitted! Waiting for Admin approval.");
            loadEmployerJobs();
        } else {
            alert("Failed to create job.");
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadEmployerJobs() {
    const tbody = document.getElementById('employer-jobs-body');
    if(!tbody) return;
    
    try {
        const response = await fetch('/api/jobs');
        const jobs = await response.json();
        
        tbody.innerHTML = '';
        if(jobs.length === 0) return tbody.innerHTML = '<tr><td colspan="5" class="text-center">No jobs created yet.</td></tr>';
        
        jobs.forEach(job => {
            let statusClass = job.Status === 'Pending' ? 'status-pending' : (job.Status === 'Approved' ? 'status-accepted' : 'status-declined');
            if (job.Status === 'Closed') statusClass = 'status-declined';

            let actionHtml = '-';
            if (job.Status === 'Approved') {
                actionHtml = `<button class="btn btn-outline btn-small" onclick="closeJob(${job.JobID})">Close Job</button>`;
            }
            
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: bold;">${job.JobTitle}</td>
                    <td>${job.DailyWage} PHP</td>
                    <td>${job.JobType}</td>
                    <td><span class="status-badge ${statusClass}">${job.Status}</span></td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error(err);
    }
}

async function closeJob(jobId) {
    if(!confirm("Are you sure you want to close this job listing?")) return;
    
    try {
        const response = await fetch(`/api/jobs/${jobId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Closed' })
        });
        
        if(response.ok) loadEmployerJobs();
    } catch (err) {
        console.error(err);
    }
}

// --- APPLICANT TRACKING & MODAL LOGIC ---
let employerApps = []; 

async function loadApplicants() {
    const tbody = document.getElementById('employer-apps-body');
    if(!tbody) return;
    
    try {
        const response = await fetch('/api/applications');
        employerApps = await response.json();
        
        tbody.innerHTML = '';
        if(employerApps.length === 0) return tbody.innerHTML = '<tr><td colspan="5" class="text-center">No applications received yet.</td></tr>';
        
        employerApps.forEach(app => {
            const appName = app.ApplicantName || "Juan Dela Cruz"; 
            let statusClass = app.Status === 'Pending' ? 'status-pending' : (app.Status === 'Accepted' ? 'status-accepted' : 'status-declined');
            
            let actionHtml = '-';
            if (app.Status === 'Pending') {
                actionHtml = `
                    <button class="btn btn-success btn-small" onclick="processApp(${app.ApplicationID}, 'Accepted')">Accept</button>
                    <button class="btn btn-danger btn-small" onclick="processApp(${app.ApplicationID}, 'Declined')" style="margin-left: 5px;">Decline</button>
                `;
            } else if (app.WorkerResponse && app.WorkerResponse !== 'Pending') {
                 actionHtml = `<small>Worker: ${app.WorkerResponse}</small>`;
            }
            
            tbody.innerHTML += `
                <tr>
                    <td>
                        <strong style="color: var(--primary-blue);">${appName}</strong> <br>
                        <a href="#" onclick="openModal(${app.ApplicationID})" style="font-size: 0.85rem; color: var(--secondary-blue); text-decoration: underline;">View Full Application</a>
                    </td>
                    <td>${app.JobTitle || 'Job #' + app.JobID}</td>
                    <td>${app.DateApplied || 'Recently'}</td>
                    <td><span class="status-badge ${statusClass}">${app.Status}</span></td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error(err);
    }
}

async function processApp(appId, newStatus) {
    try {
        const response = await fetch(`/api/applications/${appId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if(response.ok) loadApplicants(); 
    } catch (err) {
        console.error(err);
    }
}

// --- MODAL FUNCTIONS ---
function openModal(appId) {
    const app = employerApps.find(a => a.ApplicationID === appId);
    if(!app) return;

    // Database mapped fields
    document.getElementById('modal-applicant-name').innerText = app.ApplicantName || "Juan Dela Cruz";
    document.getElementById('modal-job-title').innerText = app.JobTitle || `Job #${app.JobID}`;
    document.getElementById('modal-date').innerText = app.EarliestStartDate || "Not provided";
    
    document.getElementById('modal-pitch').innerText = app.ShortPitch || "No pitch provided.";
    
    const educationStr = app.LevelOfEducation ? `${app.LevelOfEducation} - ${app.SchoolUniversity}` : "N/A";
    document.getElementById('modal-education').innerText = educationStr;
    
    document.getElementById('modal-start-date').innerText = app.EarliestStartDate || "Immediate";
    document.getElementById('modal-skills').innerText = app.RelevantSkills || "None listed";
    document.getElementById('modal-certs').innerText = app.RelevantCertifications || "None";

    if(app.ResumePath) {
        document.getElementById('modal-resume-btn').href = app.ResumePath;
        document.getElementById('modal-resume-btn').innerText = "Download Attached Resume (PDF)";
    }

    document.getElementById('applicantModal').classList.add('active');
}

function closeModal() {
    document.getElementById('applicantModal').classList.remove('active');
}

window.onclick = function(event) {
    const modal = document.getElementById('applicantModal');
    if (event.target === modal) {
        closeModal();
    }
}