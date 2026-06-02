const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // For handling PDF uploads
const sql = require('mssql'); 
const { poolPromise } = require('./dbConfig');
require('dotenv').config();

const app = express();
require('dotenv').config();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files (HTML, CSS, JS) and the uploaded resumes
app.use(express.static(path.join(__dirname, 'public')));

// --- Multer Storage Configuration for Resumes ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/'); // Save to the uploads folder
    },
    filename: function (req, file, cb) {
        // Create a unique filename for the PDF
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are allowed!'), false);
    }
});

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Login (All Users)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Email', sql.VarChar, email)
            .input('Password', sql.VarChar, password)
            .input('Role', sql.VarChar, role)
            .query('SELECT UserID, Role, FirstName, LastName, Email FROM Users WHERE Email = @Email AND Password = @Password AND Role = @Role');
            
        if (result.recordset.length > 0) {
            res.json({ success: true, message: "Login successful", user: result.recordset[0] });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials or wrong account type." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Login Error", error: err.message });
    }
});

// Worker Registration
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, mi, dob, contact, address, email, password } = req.body;
        const pool = await poolPromise;
        
        // Check if email already exists
        const checkEmail = await pool.request()
            .input('Email', sql.VarChar, email)
            .query('SELECT UserID FROM Users WHERE Email = @Email');
            
        if (checkEmail.recordset.length > 0) return res.status(400).json({ success: false, message: 'Email is already registered!' });

        // Insert new worker
        await pool.request()
            .input('Role', sql.VarChar, 'Worker')
            .input('FirstName', sql.VarChar, firstName)
            .input('LastName', sql.VarChar, lastName)
            .input('MiddleInitial', sql.VarChar, mi || '') // Fallback for optional MI
            .input('DateOfBirth', sql.Date, dob)
            .input('ContactNumber', sql.VarChar, contact)
            .input('Address', sql.VarChar, address)
            .input('Email', sql.VarChar, email)
            .input('Password', sql.VarChar, password)
            .query(`
                INSERT INTO Users (Role, FirstName, LastName, MiddleInitial, DateOfBirth, ContactNumber, Address, Email, Password)
                VALUES (@Role, @FirstName, @LastName, @MiddleInitial, @DateOfBirth, @ContactNumber, @Address, @Email, @Password)
            `);
            
        res.status(201).json({ success: true, message: "Worker account created successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Registration Error", error: err.message });
    }
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// 1. Worker Registration Endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, mi, dob, contact, address, email, password } = req.body;
        const pool = await poolPromise;
        
        // Check if email already exists
        const checkEmail = await pool.request()
            .input('Email', require('mssql').VarChar, email)
            .query('SELECT UserID FROM Users WHERE Email = @Email');
            
        if (checkEmail.recordset.length > 0) return res.status(400).json({ message: 'Email is already registered!' });

        // Insert new worker
        await pool.request()
            .input('Role', require('mssql').VarChar, 'Worker')
            .input('FirstName', require('mssql').VarChar, firstName)
            .input('LastName', require('mssql').VarChar, lastName)
            .input('MiddleInitial', require('mssql').VarChar, mi)
            .input('DateOfBirth', require('mssql').Date, dob)
            .input('ContactNumber', require('mssql').VarChar, contact)
            .input('Address', require('mssql').VarChar, address)
            .input('Email', require('mssql').VarChar, email)
            .input('Password', require('mssql').VarChar, password)
            .query(`
                INSERT INTO Users (Role, FirstName, LastName, MiddleInitial, DateOfBirth, ContactNumber, Address, Email, Password)
                VALUES (@Role, @FirstName, @LastName, @MiddleInitial, @DateOfBirth, @ContactNumber, @Address, @Email, @Password)
            `);
            
        res.status(201).json({ message: "Worker account created successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Registration Error", error: err.message });
    }
});

// 2. Login Endpoint (Centralized for all roles)
app.post('/api/login', async (req, res) => {
    try {
        const { role, email, password } = req.body;

        // Query the database to verify credentials and role
        const result = await pool.request()
            .input('Role', sql.VarChar, role)
            .input('Email', sql.VarChar, email)
            .input('Password', sql.VarChar, password)
            .query(`
                SELECT UserID, Role, FirstName, LastName, Email 
                FROM Users 
                WHERE Email = @Email AND Password = @Password AND Role = @Role
            `);

        // If a match is found
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            res.status(200).json({ 
                message: 'Login successful', 
                user: user 
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials or incorrect account type.' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});


// ==========================================
// 2. JOB LISTING ROUTES
// ==========================================

// Get all jobs (Includes logic to join the Employer's Company/Name)
app.get('/api/jobs', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT j.*, u.FirstName + ' ' + u.LastName AS EmployerName 
            FROM Jobs j
            LEFT JOIN Users u ON j.EmployerID = u.UserID
            ORDER BY j.JobID DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send({ message: "Error fetching jobs", error: err.message });
    }
});

// Get a specific job by ID
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('JobID', require('mssql').Int, req.params.id)
            .query('SELECT * FROM Jobs WHERE JobID = @JobID');
        
        if (result.recordset.length > 0) res.json(result.recordset[0]);
        else res.status(404).json({ message: "Job not found" });
    } catch (err) {
        res.status(500).send({ message: "Error fetching job", error: err.message });
    }
});

// Create a new job (Employer)
app.post('/api/jobs', async (req, res) => {
    try {
        const { employerId, title, wage, location, type, schedule, skills, desc } = req.body;
        const pool = await poolPromise;
        
        await pool.request()
            .input('EmployerID', require('mssql').Int, employerId)
            .input('JobTitle', require('mssql').VarChar, title)
            .input('DailyWage', require('mssql').Decimal, wage)
            .input('Location', require('mssql').VarChar, location)
            .input('JobType', require('mssql').VarChar, type)
            .input('Schedule', require('mssql').VarChar, schedule)
            .input('RequiredSkills', require('mssql').Text, skills)
            .input('JobDescription', require('mssql').Text, desc)
            .input('Status', require('mssql').VarChar, 'Pending')
            .query(`
                INSERT INTO Jobs (EmployerID, JobTitle, DailyWage, Location, JobType, Schedule, RequiredSkills, JobDescription, Status)
                VALUES (@EmployerID, @JobTitle, @DailyWage, @Location, @JobType, @Schedule, @RequiredSkills, @JobDescription, @Status)
            `);
            
        res.status(201).json({ message: "Job created successfully!" });
    } catch (err) {
        res.status(500).send({ message: "Error creating job", error: err.message });
    }
});

// Update Job Status (Admin Approving/Declining OR Employer Closing)
app.put('/api/jobs/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const pool = await poolPromise;
        
        await pool.request()
            .input('Status', require('mssql').VarChar, status)
            .input('JobID', require('mssql').Int, req.params.id)
            .query('UPDATE Jobs SET Status = @Status WHERE JobID = @JobID');
            
        res.json({ message: `Job status updated to ${status}` });
    } catch (err) {
        res.status(500).send({ message: "Error updating job", error: err.message });
    }
});


// ==========================================
// 3. APPLICATION ROUTES
// ==========================================

// Get specific user profile (Needed for pre-filling application forms)
app.get('/api/users/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', require('mssql').Int, req.params.id)
            .query('SELECT FirstName, LastName, MiddleInitial, DateOfBirth, ContactNumber, Address, Email FROM Users WHERE UserID = @UserID');
        
        if (result.recordset.length > 0) res.json(result.recordset[0]);
        else res.status(404).json({ message: "User not found" });
    } catch (err) {
        res.status(500).send({ message: "Error fetching user data", error: err.message });
    }
});

// Get all applications (Joined with Job and User tables for full detail views)
app.get('/api/applications', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT a.*, j.JobTitle, j.Location, u.FirstName + ' ' + u.LastName AS ApplicantName 
            FROM Applications a
            JOIN Jobs j ON a.JobID = j.JobID
            JOIN Users u ON a.WorkerID = u.UserID
            ORDER BY a.ApplicationID DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send({ message: "Error fetching applications", error: err.message });
    }
});

// Submit a new application (Worker) - Includes PDF Upload using Multer
app.post('/api/applications', upload.single('resume'), async (req, res) => {
    try {
        const { jobId, workerId, pitch, education, school, degree, skills, certs, startDate } = req.body;
        
        // Get the local path of the uploaded file
        const resumePath = req.file ? `/uploads/${req.file.filename}` : '';
        
        const pool = await poolPromise;
        
        await pool.request()
            .input('JobID', require('mssql').Int, jobId)
            .input('WorkerID', require('mssql').Int, workerId)
            .input('ShortPitch', require('mssql').Text, pitch)
            .input('LevelOfEducation', require('mssql').VarChar, education)
            .input('SchoolUniversity', require('mssql').VarChar, school)
            .input('Degree', require('mssql').VarChar, degree || '')
            .input('RelevantSkills', require('mssql').Text, skills)
            .input('RelevantCertifications', require('mssql').Text, certs || '')
            .input('EarliestStartDate', require('mssql').Date, startDate)
            .input('ResumePath', require('mssql').VarChar, resumePath)
            .input('Status', require('mssql').VarChar, 'Pending')
            .input('WorkerResponse', require('mssql').VarChar, 'Pending')
            .query(`
                INSERT INTO Applications 
                (JobID, WorkerID, ShortPitch, LevelOfEducation, SchoolUniversity, Degree, RelevantSkills, RelevantCertifications, EarliestStartDate, ResumePath, Status, WorkerResponse)
                VALUES 
                (@JobID, @WorkerID, @ShortPitch, @LevelOfEducation, @SchoolUniversity, @Degree, @RelevantSkills, @RelevantCertifications, @EarliestStartDate, @ResumePath, @Status, @WorkerResponse)
            `);
            
        res.status(201).json({ message: "Application submitted successfully!" });
    } catch (err) {
        res.status(500).send({ message: "Error submitting application", error: err.message });
    }
});

// Update Application Status (Employer Accepting/Declining)
app.put('/api/applications/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const pool = await poolPromise;
        
        await pool.request()
            .input('Status', require('mssql').VarChar, status)
            .input('ApplicationID', require('mssql').Int, req.params.id)
            .query('UPDATE Applications SET Status = @Status WHERE ApplicationID = @ApplicationID');
            
        res.json({ message: `Application status updated to ${status}` });
    } catch (err) {
        res.status(500).send({ message: "Error updating application status", error: err.message });
    }
});

// Update Worker Response (Worker Accepting/Declining an Offer)
app.put('/api/applications/:id/response', async (req, res) => {
    try {
        const { workerResponse } = req.body;
        const pool = await poolPromise;
        
        await pool.request()
            .input('WorkerResponse', require('mssql').VarChar, workerResponse)
            .input('ApplicationID', require('mssql').Int, req.params.id)
            .query('UPDATE Applications SET WorkerResponse = @WorkerResponse WHERE ApplicationID = @ApplicationID');
            
        res.json({ message: `Worker response updated to ${workerResponse}` });
    } catch (err) {
        res.status(500).send({ message: "Error submitting response", error: err.message });
    }
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 AsulWorks Server is running on http://localhost:${PORT}`);
});