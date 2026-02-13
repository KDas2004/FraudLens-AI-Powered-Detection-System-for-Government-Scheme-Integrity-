require("dotenv").config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Application = require("./models/Application.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const { isLoggedIn } = require("./middleware.js");
const upload = require("./multer.js");
const Blockchain = require("./blockchain/blockchain");
const Block = require("./blockchain/block");
const checkTampering = require("./services/aiTamperCheck");

const chain = new Blockchain();

app.use(methodOverride("_method"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));
app.use("/uploads", express.static("uploads"));

const MONGO_URL = "mongodb://127.0.0.1:27017/fraudbene";

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("connected to DB");
}
main().catch((err) => console.log(err));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

const sessionOption = {
  secret: "mysupersecretcode",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
};

app.use(session(sessionOption));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

const userRouter = require("./routes/user.js");
app.use("/", userRouter);

app.get("/", (req, res) => {
  res.send("Hi, this is VOIS'S PROJECT HOME PAGE");
});

app.get("/applications", async (req, res) => {
  const allApplications = await Application.find({});
  res.render("applications/index", { allApplications });
});

app.get("/applications/new", isLoggedIn, (req, res) => {
  res.render("applications/new.ejs");
});

app.get("/applications/:id", async (req, res) => {
  let { id } = req.params;
  const application = await Application.findById(id);
  res.render("applications/show.ejs", { application });
});

app.delete("/applications/:id", async (req, res) => {
  let { id } = req.params;
  await Application.findByIdAndDelete(id);
  res.redirect("/applications");
});

app.get("/dashboard", async (req, res) => {
  try {
    const total = await Application.countDocuments();

    const fraud = await Application.countDocuments({ fraud: true });

    const tampered = await Application.countDocuments({ tamperStatus: true });

    const blocks = chain.chain.length;   // blockchain blocks count

    res.render("dashboard/dashboard", {
      total,
      fraud,
      tampered,
      blocks
    });

  } catch (err) {
    console.log(err);
    res.send("Dashboard error");
  }
});

app.get("/blockchain", (req, res) => {
  res.json(chain.chain);
});

// ===============================
// MAIN APPLICATION SUBMIT ROUTE
// ===============================
app.post(
  "/applications",
  upload.fields([
    { name: "aadhaarFile", maxCount: 100 },
    { name: "panFile", maxCount: 100 },
  ]),
  async (req, res) => {
    try {
      const userIP = req.ip;

      if (!req.body.application) {
        req.flash("error", "Invalid form submission");
        return res.redirect("/applications/new");
      }

      if (!req.files?.aadhaarFile || !req.files?.panFile) {
        req.flash("error", "Both Aadhaar and PAN files required");
        return res.redirect("/applications/new");
      }

      const aadhaarPath = req.files["aadhaarFile"][0].path;
      const panPath = req.files["panFile"][0].path;

      // Function to clean AI response
      function cleanAIResponse(text) {
        return text.replace(/```json|```/g, "").trim();
      }

      // ======================
      // AI CHECK FOR AADHAAR
      // ======================
      const aadhaarResult = await checkTampering(aadhaarPath);
      console.log("AADHAAR RESULT:", aadhaarResult);

      let parsedAadhaar;
      try {
        const cleaned = cleanAIResponse(aadhaarResult);
        parsedAadhaar = JSON.parse(cleaned);
        aadhaarConfidence = Math.round(parsedAadhaar.confidence * 100);
      } catch (e) {
        console.log("AI parsing error:", e);
        req.flash("error", "AI could not analyze Aadhaar document");
        return res.redirect("/applications/new");
      }

      // number entered in form
      const enteredAadhaar = req.body.application.aadhaar_no;

      // number extracted by AI
      const extractedAadhaar = parsedAadhaar.extractedNumber;

     // compare (remove spaces for safety)
     if (
        extractedAadhaar &&
        extractedAadhaar.replace(/\s/g, "") !== enteredAadhaar.replace(/\s/g, "")
      ) {
      req.flash("error", "Aadhaar number does not match document");
      return res.redirect("/applications/new");
    }

    // Aadhaar validations
      if (parsedAadhaar.documentType !== "aadhaar") {
      req.flash("error", "Application cancelled: Invalid Aadhaar document.");
      return res.redirect("/applications/new");
      }

      if (parsedAadhaar.tampered === true) {
      req.flash(
      "error",
      `Application cancelled: Aadhaar appears tampered. Reason: ${parsedAadhaar.reason}`
      );
      return res.redirect("/applications/new");
    }
      // ======================
      // AI CHECK FOR PAN
      // ======================
      const panResult = await checkTampering(panPath);
      console.log("PAN RESULT:", panResult);

      let parsedPan;
      try {
        const cleaned = cleanAIResponse(panResult);
        parsedPan = JSON.parse(cleaned);
        panConfidence = Math.round(parsedPan.confidence * 100);
      } catch (e) {
        console.log("AI parsing error:", e);
        req.flash("error", "AI could not analyze PAN document");
        return res.redirect("/applications/new");
      }

      const enteredPan = req.body.application.pan_no;
      const extractedPan = parsedPan.extractedNumber;

if (
  extractedPan &&
  extractedPan.replace(/\s/g, "").toUpperCase() !== enteredPan.toUpperCase()
) {
  req.flash("error", "PAN number does not match document");
  return res.redirect("/applications/new");
}

      // PAN validations
      if (parsedPan.documentType !== "pan") {
      req.flash("error", "Application cancelled: Invalid PAN document.");
      return res.redirect("/applications/new");
      }

      if (parsedPan.tampered === true) {
      req.flash(
      "error",
      `Application cancelled: PAN appears tampered. Reason: ${parsedPan.reason}`
      );
      return res.redirect("/applications/new");
      }

      const finalConfidence = Math.min(aadhaarConfidence, panConfidence);

      // ======================
      // DUPLICATE CHECK
      // ======================
      const existing = await Application.findOne({
        $or: [
          { aadhaar_no: req.body.application.aadhaar_no },
          { pan_no: req.body.application.pan_no },
        ],
      });

      let isFraud = existing ? true : false;

      const attemptCount = await Application.countDocuments({ ipAddress: userIP });

if (attemptCount >= 3) {
  req.flash("error", "Too many attempts detected from this device. Try again later.");
  return res.redirect("/applications/new");
}

const tamperStatus = parsedAadhaar.tampered || parsedPan.tampered;

const tamperScore = Math.min(
  Math.round(parsedAadhaar.confidence * 100),
  Math.round(parsedPan.confidence * 100)
);

const tamperReason =
  parsedAadhaar.reason || parsedPan.reason || "No issue detected";

      // ======================
      // SAVE APPLICATION
      // ======================
      const application = new Application({
  ...req.body.application,
  aadhaar_file: req.files["aadhaarFile"][0].filename,
  pan_file: req.files["panFile"][0].filename,
  fraud: isFraud,
  tamperStatus,
  tamperScore,
  tamperReason,
  ipAddress: userIP,
  attempts: attemptCount + 1
});

      await application.save();

      // ======================
      // BLOCKCHAIN ENTRY
      // ======================
      const blockData = {
        aadhaar_no: application.aadhaar_no,
        pan_no: application.pan_no,
        fraud: application.fraud,
      };

      const block = new Block(Date.now().toString(), blockData);
      chain.addBlock(block);

      if (isFraud) {
        req.flash("error", "Duplicate Aadhaar or PAN detected!");
        return res.redirect("/applications/new");
      }

      req.flash("success", "Application submitted successfully!");
      res.redirect("/applications");

    } catch (err) {
  console.error("ERROR DETAILS:", err);
  req.flash("error", err.message);
  res.redirect("/applications/new");
}
  }
);

app.listen(8080, () => {
  console.log("Server is listening to port 8080");
});