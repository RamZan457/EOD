const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const e = require('express');

const teacherSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    serviceType: String,
    cnic: { type: String, unique: true },
    dob: String,
    contactNumber: String,
    initialAppointment: String,
    experience: String,
    role: {
        type: String,
        default: 'teacher'
    },
    grade: String,
    maritalStatus: String,
    homeAddress: String,
    currentSchool: String,
    dateOfJoining: String,
    dateOfJoiningNewSchool: {
        type: String,
        default: 0
    },
    postedAs: String,
    isRequestPending: Boolean,
    newSchoolRequest: {
        type: String,
        default: ''
    },
    vacancyId: {
        type: String,
        default: ''
    },
    reason: {
        type: String,
        default: ''
    },
    ethAddress: String // Ethereum Address
});

// Hash password before saving
teacherSchema.pre('save', async function(next) {
    if (this.isModified('password') || this.isNew) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// Method to compare passwords
teacherSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const Teacher = mongoose.model('Teacher', teacherSchema);

module.exports = Teacher;
