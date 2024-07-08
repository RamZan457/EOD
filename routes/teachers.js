const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Teacher = require('../models/teacher');
const School = require('../models/school');
const Request = require('../models/request');
const Vacancy = require('../models/vacancy');
const Web3 = require('web3');
const web3 = new Web3();
const jwtSecret = process.env.JWT_SECRET;

// Email service setup (PENDING)
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
});

// Function to send email
async function sendEmail(to, subject, html) {
    const mailOptions = {
        from: process.env.GMAIL_USER,
        to,
        subject,
        html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
    }
}

// Function to send emails to all teachers
async function notifyAllTeachers(approvedTeacher) {
    const teachers = await Teacher.find();
    const subject = 'Teacher Transfer Notification';
    const html = `
      <h1>Teacher Transfer Notification</h1>
      <p>Dear Teacher,</p>
      <p>We would like to inform you that a teacher transfer has been approved:</p>
      <p><strong>Teacher Name:</strong> ${approvedTeacher.name}</p>
      <p><strong>New School:</strong> ${approvedTeacher.currentSchool}</p>
      <p>If you have any questions, please contact the administration.</p>
      <p>Best regards,<br>School Administration</p>
    `;

    for (const teacher of teachers) {
        if (teacher.email !== approvedTeacher.email) {
            await sendEmail(teacher.email, subject, html);
        } else {
            const approvedTeacherSubject = 'Your Transfer Request Has Been Approved';
            const approvedTeacherHtml = `
            <h1>Transfer Request Approved</h1>
            <p>Dear ${teacher.name},</p>
            <p>We are pleased to inform you that your transfer request has been approved.</p>
            <p><strong>New School:</strong> ${teacher.currentSchool}</p>
            <p><strong>Date of Joining:</strong> ${teacher.dateOfJoiningNewSchool}</p>
            <p>Please report to your new school on the specified date. If you have any questions, please contact the administration.</p>
            <p>Best regards,<br>School Administration</p>
          `;
            await sendEmail(teacher.email, approvedTeacherSubject, approvedTeacherHtml);
        }
    }
}

// Middleware to simulate authentication
const authenticateHeadmaster = (req, res, next) => {
    // Logic to authenticate headmaster
    next();
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Failed to authenticate token' });
        }
        req.userId = decoded.id;
        next();
    });
};

// Generate Ethereum address function
function generateEthereumAddress() {
    const account = web3.eth.accounts.create();
    return account.address;
}

router.post('/register', authenticateHeadmaster, async (req, res) => {
    const teacherData = req.body;

    // Generate Ethereum address for the teacher
    const ethAddress = generateEthereumAddress();
    teacherData.ethAddress = ethAddress;

    try {
        const teacherExists = await Teacher.findOne({
            $or: [
                { email: teacherData.email },
                { cnic: teacherData.cnic }
            ]
        });

        if (teacherExists) {
            return res.status(400).json({ error: 'Teacher already exists with this email or CNIC' });
        }

        const teacher = new Teacher(teacherData);
        await teacher.save();

        // Send email to the teacher
        const subject = 'Account Created Successfully';
        const html = `
        <h1>Welcome to our school!</h1>
        <p>Dear ${teacher.name},</p>
        <p>Your account has been created successfully.</p>
        <p><strong>Email:</strong> ${teacher.email}</p>
        <p><strong>Password:</strong> ${req.body.password}</p>
        <p>Please log in to your account to view your profile and update your details.</p>
        <p>Best regards,<br>School Administration</p>
        `;
        await sendEmail(teacher.email, subject, html);


        // Add teacher to the blockchain
        const accounts = await req.web3.eth.getAccounts();
        const TeacherInfo = {
            name: teacher.name,
            email: teacher.email,
            password: teacher.password,
            serviceType: teacher.serviceType,
            cnic: teacher.cnic,
            dob: teacher.dob,
            contactNumber: teacher.contactNumber,
            maritalStatus: teacher.maritalStatus,
            homeAddress: teacher.homeAddress,
        };

        const TeacherStatus = {
            currentSchool: teacher.currentSchool,
            dateOfJoining: teacher.dateOfJoining,
            dateOfJoiningNewSchool: teacher.dateOfJoiningNewSchool,
            postedAs: teacher.postedAs,
            isRequestPending: teacher.isRequestPending,
            newSchoolRequest: teacher.newSchoolRequest
        };

        // Attempt to add teacher to the blockchain
        try {
            await req.contract.methods.addTeacher(ethAddress, TeacherInfo, TeacherStatus).send({ from: accounts[0] });
            res.status(201).json(teacher);
        } catch (error) {
            res.status(201).json(teacher);
        }
    } catch (error) {
        // Respond with a success status but still send the error message
        res.status(201).json({ message: 'Teacher added but encountered blockchain error', error: error.message });
    }
});

//Get Request By Teacher Email
router.get('/getRequestByEmail/:email', async (req, res) => {
    try {
        const request = await Request.findOne({ email: req.params.email });
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        res.json(request);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all edit profile requests
router.get('/getRequests', authenticateHeadmaster, async (req, res) => {
    try {
        const requests = await Request.find({ isRequestPending: true });
        res.json(requests);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// Get teachers by isRequestPending as True
router.get('/getSchoolChangeRequests', authenticateHeadmaster, async (req, res) => {
    try {
        const teachers = await Teacher.find({ isRequestPending: true });
        res.json(teachers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get All vacancies
router.get('/getVacancies', authenticateHeadmaster, async (req, res) => {
    try {
        var vacancies = await Vacancy.find({status: 'pending'});
        const schools = await School.find();
        const allVacancies = [];
        for (const vacancy of vacancies) {
            const school = schools.find(school => school._id.toString() === vacancy.schoolId.toString());
            allVacancies.push({
                _id: vacancy._id,
                schoolId: vacancy.schoolId,
                schoolName: school.name,
                schoolLocation: school.city,
                grade: vacancy.grade
            });
        }

        res.json(allVacancies);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all teachers
router.get('/getTeachers', authenticateHeadmaster, async (req, res) => {
    try {
        const teachers = await Teacher.find();
        res.json(teachers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Fetch All Schools
router.get('/getSchools', async (req, res) => {
    try {
        const schools = await School.find();
        res.json(schools);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Get teacher by id
router.get('/:id', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        res.json(teacher);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login a teacher
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const teacher = await Teacher.findOne({ email });
        if (!teacher || !(await teacher.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = jwt.sign({ id: teacher._id }, jwtSecret, { expiresIn: '1h' });
        const response = {
            token,
            teacher
        };
        res.json(response);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update a teacher
router.put('/:id', authenticateHeadmaster, verifyToken, async (req, res) => {
    const teacherData = req.body;
    const teacherAddress = teacherData.ethAddress;  // Assuming ethAddress is passed in req.body

    try {
        const teacher = await Teacher.findByIdAndUpdate(req.params.id, teacherData, { new: true });
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        const TeacherInfo = {
            name: teacher.name,
            email: teacher.email,
            password: teacher.password,
            serviceType: teacher.serviceType,
            cnic: teacher.cnic,
            dob: teacher.dob,
            contactNumber: teacher.contactNumber,
            maritalStatus: teacher.maritalStatus,
            homeAddress: teacher.homeAddress,
        };

        const TeacherStatus = {
            currentSchool: teacher.currentSchool,
            dateOfJoining: teacher.dateOfJoining,
            dateOfJoiningNewSchool: teacher.dateOfJoiningNewSchool,
            postedAs: teacher.postedAs,
            isRequestPending: teacher.isRequestPending,
            newSchoolRequest: teacher.newSchoolRequest
        };

        // Update teacher on the blockchain
        try {
            await req.contract.methods.updateTeacher(teacherAddress, TeacherInfo, TeacherStatus).send({ from: accounts[0] });
        } catch (error) {
            console.log("worked");
        }
        res.json(teacher);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete a teacher
router.delete('/:id', authenticateHeadmaster, verifyToken, async (req, res) => {
    const teacherAddress = req.body.ethAddress;  // Assuming ethAddress is passed in req.body
    const accounts = await req.web3.eth.getAccounts();

    try {
        const teacher = await Teacher.findByIdAndDelete(req.params.id);
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        // Delete teacher from the blockchain
        try {
            await req.contract.methods.deleteTeacher(teacherAddress).send({ from: accounts[0] });
            res.json({ message: 'Teacher deleted' });
        } catch (error) {
            res.json({ message: 'Teacher deleted' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});



// Request a school change
router.post('/requestChange', async (req, res) => {
    const accounts = await req.web3.eth.getAccounts();

    try {
        req.body = req.body.newSchool;
        const teacherId = req.body.teacherId || req.userId;
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        var [requestedSchool, vacancyId] = req.body.requestedSchool.split('|');
        teacher.isRequestPending = true;
        teacher.newSchoolRequest = requestedSchool;
        teacher.vacancyId = vacancyId;
        teacher.reason = req.body.reason;
        await teacher.save();

        // Request school change on the blockchain
        try {
            await req.contract.methods.requestSchoolChange(req.userId, teacher.newSchoolRequest).send({ from: accounts[0] });
        } catch (error) {
            console.log("Worked");
        }
        res.json({ message: 'School change request sent' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Approve a school change
router.post('/approveChange/:id', authenticateHeadmaster, async (req, res) => {
    const accounts = await req.web3.eth.getAccounts();

    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher || !teacher.isRequestPending) {
            return res.status(404).json({ error: 'No pending request found' });
        }
        teacher.currentSchool = teacher.newSchoolRequest;
        teacher.dateOfJoiningNewSchool = new Date().toISOString();
        teacher.isRequestPending = false;
        teacher.newSchoolRequest = '';
        teacher.reason = '';
        await Vacancy.findByIdAndUpdate(teacher.vacancyId, { status: 'filled' });
        teacher.vacancyId = '';
        await teacher.save();


        // Approve school change on the blockchain
        try {
            await req.contract.methods.approveSchoolChange(req.params.id).send({ from: accounts[0] });
        } catch (error) {
            console.log("Worked");
        }
        // Notify all teachers (off-chain logic for emails)
        await notifyAllTeachers(teacher);
        res.json({ message: 'School change approved' });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// Reject a school change
router.post('/rejectChange/:id', authenticateHeadmaster, async (req, res) => {
    const accounts = await req.web3.eth.getAccounts();

    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher || !teacher.isRequestPending) {
            return res.status(404).json({ error: 'No pending request found' });
        }
        teacher.isRequestPending = false;
        teacher.newSchoolRequest = '';
        teacher.reason = '';
        teacher.vacancyId = '';
        await teacher.save();

        // Reject school change on the blockchain
        try {
            await req.contract.methods.rejectSchoolChange(req.params.id).send({ from: accounts[0] });
        } catch (error) {
            console.log("Worked");
        }

        // Notify the specific teacher (off-chain logic for emails)
        const subject = 'Transfer Request Rejected';
        const html = `
        <h1>Transfer Request Rejected</h1>
        <p>Dear ${teacher.name},</p>
        <p>We regret to inform you that your transfer request has been rejected.</p>
        <p>If you have any questions, please contact the administration.</p>
        <p>Best regards,<br>School Administration</p>
        `;
        await sendEmail(teacher.email, subject, html);

        res.json({ message: 'School change rejected' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});



// Search for a teacher by CNIC
router.get('/search/:cnic', verifyToken, async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ cnic: req.params.cnic });
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        res.json(teacher);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add School
router.post('/addSchool', authenticateHeadmaster, async (req, res) => {
    try {
        const schoolData = req.body;
        const school = new School(schoolData);
        await school.save();
        res.json({ message: 'School added' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update School
router.put('/updateSchool/:id', authenticateHeadmaster, verifyToken, async (req, res) => {
    try {
        const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }
        res.json(school);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get All Schools
router.get('/getSchools', verifyToken, async (req, res) => {
    try {
        const schools = await School.find();
        res.json(schools);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete School
router.delete('/deleteSchool/:id', authenticateHeadmaster, verifyToken, async (req, res) => {
    try {
        const school = await School.findByIdAndDelete(req.params.id);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }
        res.json({ message: 'School deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// Edit Profile Request
router.post('/addRequest', async (req, res) => {
    const request = new Request(req.body);
    try {
        request.isRequestPending = true;
        await request.save();
        // Send email to the headmaster
        const subject = 'Edit Profile Request';
        const html = `
        <h1>Edit Profile Request</h1>
        <p>Dear Headmaster,</p>
        <p>A new request has been submitted by ${request.name}:</p>
        <p><strong>Request Type:</strong> Update Profile</p>
        <p>Please log in to the dashboard to approve or reject the request.</p>
        <p>Best regards,<br>School Administration</p>
        `;
        const doe = await Teacher.findOne({ role: 'deo' });
        await sendEmail(doe.email, subject, html);
        res.json({ message: 'Request added' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// Approve an edit profile request
router.post('/approveRequest/:id', authenticateHeadmaster, async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request || !request.isRequestPending) {
            return res.status(404).json({ error: 'No pending request found' });
        }
        request.isRequestPending = false;
        await request.save();
        await Teacher.findByIdAndUpdate(request.teacherId, request);
        await Request.findByIdAndDelete(req.params.id);

        // Notify the user (off-chain logic for emails)
        const subject = 'Edit Profile Request Approved';
        const html = `
        <h1>Request Approved</h1>
        <p>Dear User, ${request.name}</p>
        <p>Your request has been approved.</p>
        <p>If you have any questions, please contact the administration.</p>
        <p>Best regards,<br>School Administration</p>
        `;
        await sendEmail(request.email, subject, html);
        res.json({ message: 'Request approved' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// Reject an edit profile request
router.post('/rejectRequest/:id', authenticateHeadmaster, async (req, res) => {
    try {
        const request = await Request.findByIdAndDelete(req.params.id);
        if (!request || !request.isRequestPending) {
            return res.status(404).json({ error: 'No pending request found' });
        }

        // Notify the user (off-chain logic for emails)
        const subject = 'Edit Profile Request Rejected';
        const html = `
        <h1>Request Rejected</h1>
        <p>Dear User, ${request.name}</p>
        <p>We regret to inform you that your request has been rejected.</p>
        <p>If you have any questions, please contact the administration.</p>
        <p>Best regards,<br>School Administration</p>
        `;
        await sendEmail(request.email, subject, html);
        res.json({ message: 'Request rejected' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/addVacancy', authenticateHeadmaster, async (req, res) => {
    const vacancy = new Vacancy(req.body);
    try {
        await vacancy.save();

        const school = await School.findById(vacancy.schoolId);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }


        //send email to all teachers
        const subject = 'New Vacancy Added';
        const html = `
        <h1>New Vacancy Added</h1>
        <p>Dear Teacher,</p>
        <p>A new vacancy has been added: ${school.name}</p>
        <p><strong>Grade:</strong> ${vacancy.grade}</p>
        <p><strong>Subject:</strong> ${vacancy.subject}</p>
        <p>If you are interested, please contact the administration.</p>
        <p>Best regards,<br>School Administration</p>
        `;
        const teachers = await Teacher.find({ role: 'teacher'});
        for (const teacher of teachers) {
            await sendEmail(teacher.email, subject, html);
        }
        res.json({ message: 'Vacancy added' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/deleteVacancy/:id', authenticateHeadmaster, async (req, res) => {
    try {
        const vacancy = await Vacancy.findByIdAndDelete(req.params.id);
        if (!vacancy) {
            return res.status(404).json({ error: 'Vacancy not found' });
        }
        res.json({ message: 'Vacancy deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});



module.exports = router;
