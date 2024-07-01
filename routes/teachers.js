const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Teacher = require('../models/teacher');
const School = require('../models/school');
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
        const teacher = new Teacher(teacherData);
        await teacher.save();

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
    const accounts = await req.web3.eth.getAccounts();

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
            res.json(teacher);
        } catch (error) {
            res.json(teacher);
        }
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

// Get teachers by isRequestPending as True
router.get('/getSchoolChangeRequests', authenticateHeadmaster, async (req, res) => {
    try {
        const teachers = await Teacher.find({ isRequestPending: true });
        res.json(teachers);
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
        teacher.isRequestPending = true;
        teacher.newSchoolRequest = req.body.requestedSchool;
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
        await teacher.save();

        // Approve school change on the blockchain
        try {
            await req.contract.methods.approveSchoolChange(req.params.id).send({ from: accounts[0] });
        } catch (error) {
            console.log("Worked");
        }
        // Notify all teachers (off-chain logic for emails)
        const teacherList = await Teacher.find();
        // Notify all teachers
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

// Get all teachers
router.get('/getTeachers', authenticateHeadmaster, async (req, res) => {
    try {
        const teachers = await Teacher.find();
        res.json(teachers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add School
router.post('/addSchool', authenticateHeadmaster, verifyToken, async (req, res) => {
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

// Get All Schools
router.get('/getSchools', verifyToken, async (req, res) => {
    try {
        const schools = await School.find();
        res.json(schools);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
