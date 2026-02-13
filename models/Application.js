const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    aadhaar_no: String,
    pan_no: String,

    aadhaar_file: String,
    pan_file: String,
    tamperStatus: String,
    tamperScore: Number,
    tamperReason: String,

    ipAddress: String,
    attempts: { type: Number, default: 1 },

    fraud: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model("Application", applicationSchema);