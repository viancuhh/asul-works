// ==========================================
// ADMIN MODULE (Database Connected)
// ==========================================

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    loadPendingJobs();
});

async function loadPendingJobs() {
    const tbody = document.getElementById('admin-pending-jobs');
    
    try {
        const response = await fetch('/api/jobs');
        const jobs = await response.json();
        
        tbody.innerHTML = '';

        const pendingJobs = jobs.filter(j => j.Status === 'Pending'); 
        
        if(pendingJobs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem;">No pending job listings. All caught up!</td></tr>';
            return;
        }
        
        pendingJobs.forEach(job => {
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: bold;">Employer ID: ${job.EmployerID}</td>
                    <td>
                        ${job.JobTitle} <br>
                        <small class="text-light">${job.JobDescription ? job.JobDescription.substring(0, 40) : ''}...</small>
                    </td>
                    <td>${job.DailyWage} PHP<br><small class="text-light">${job.JobType}</small></td>
                    <td>${job.Location}</td>
                    <td>
                        <button class="btn btn-success btn-small" onclick="reviewJob(${job.JobID}, 'Approved')">Approve</button>
                        <button class="btn btn-danger btn-small" onclick="reviewJob(${job.JobID}, 'Declined')" style="margin-left: 5px;">Decline</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Failed to load pending jobs:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error fetching jobs from database.</td></tr>';
    }
}

async function reviewJob(jobId, newStatus) {
    if(!confirm(`Are you sure you want to mark this job as ${newStatus}?`)) return;
    
    try {
        const response = await fetch(`/api/jobs/${jobId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if(response.ok) {
            loadPendingJobs();
        } else {
            alert("Failed to update job status.");
        }
    } catch (error) {
        console.error("Failed to update job:", error);
    }
}