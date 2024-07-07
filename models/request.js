const mongoose = require('mongoose');
const requestSchema = new mongoose.Schema({
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
    reason: {
        type: String,
        default: ''
    },
    ethAddress: String // Ethereum Address
});

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;