const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema({
    name: { type: String, required: true },

    email: { type: String, required: true },

    phone: { type: String, required: true },

    aadhaar_no: { type: String, required: true },

    pan_no: { type: String, required: true },

    aadhaarFile: { type: String },   // stores filename
    panFile: { type: String },       // stores filename

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Application", ApplicationSchema);
