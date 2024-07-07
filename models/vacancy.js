const mongoose = require('mongoose');

const vacancySchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School'
    },
    grade: String,
    subject: String,
    status: {
        type: String,
        default: 'pending'
    }
});

const Vacancy = mongoose.model('Vacancy', vacancySchema);

module.exports = Vacancy;