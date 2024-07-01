const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    name: String,
    city: String,
    Schooladdress: String,
    contactNumber: String
});

const School = mongoose.model('School', schoolSchema);

module.exports = School;