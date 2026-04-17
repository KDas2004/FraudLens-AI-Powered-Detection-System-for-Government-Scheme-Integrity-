const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  aadhaar_no: String,
  pan_no: String,
  aadhaar_file: String,
  pan_file: String,

  // existing tamper fields
  tamperStatus: String,
  tamperScore: Number,
  tamperReason: String,

  // existing fraud
  fraud: { type: Boolean, default: false },
  ipAddress: String,
  attempts: { type: Number, default: 1 },

  // ✅ NEW FIELDS
  scheme: { type: String, default: "GENERAL" },       // which welfare scheme
  fraudScore: { type: Number, default: 0 },           // 0-100 composite score
  fraudVerdict: { type: String, default: "LOW RISK" },// HIGH / MEDIUM / LOW
  fraudReasons: [{ type: String }],                   // array of reasons
  fillTimeSeconds: { type: Number, default: null },   // form fill speed
  submittedAt: { type: Date, default: Date.now },     // submission timestamp
});

module.exports = mongoose.model("Application", applicationSchema);