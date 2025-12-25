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
const {isLoggedIn} = require("./middleware.js");
const upload = require("./multer.js");
const Blockchain = require("./blockchain/blockchain");
const Block = require("./blockchain/block");
const chain = new Blockchain();

app.use(methodOverride("_method"));
app.use(express.urlencoded({ extended: true }));

const MONGO_URL = "mongodb://127.0.0.1:27017/fraudbene";

const userRouter = require("./routes/user.js");

main()
   .then(() => {
    console.log("connected to DB");
}).catch((err) => {
    console.log(err);
});

async function main() {
    await mongoose.connect(MONGO_URL);
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const sessionOption = {
    secret: "mysupersecretcode",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
};

app.get("/", (req, res) => {
    res.send("Hi, this is VOIS'S PROJECT HOME PAGE");
});

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

/*app.get("/demouser", async (req, res) => {
    let fakeUser = new User({
        email: "student@gmail.com",
        username: "sigma-student"
    });

    let registeredUser = await User.register(fakeUser, "helloworld");
    res.send(registeredUser);
});*/

//user route
app.use("/", userRouter);

//index route
app.get("/applications", async (req, res) => {
    const allApplications = await Application.find({});
    res.render("applications/index", { allApplications });
    });

//New Route
app.get("/applications/new", isLoggedIn, (req, res) => {
    res.render("applications/new.ejs");
});

//show route
app.get("/applications/:id", async (req, res) => {
    let {id} = req.params;
    const application = await Application.findById(id);
    res.render("applications/show.ejs", {application});
});

//Delete route
app.delete("/applications/:id", async (req, res) => {
    let {id} = req.params;
    let deletedApplication = await Application.findByIdAndDelete(id);
    console.log(deletedApplication);
    res.redirect("/applications");
});

/*app.get("/testSchema", async (req, res) => {
    let sampleApplication = new Application ({
  _id: "6703a2fbbd2f11e3c48762a1",
  name: "Rahul Sharma",
  email: "rahul@example.com",
  phone: "9876543210",
  aadhaar_hash: "5c1e87c35a9f8d8140b8f9e2a97b1a4a6c4b7d3c8d...",
  aadhaar_masked: "1234-56********",
  pan_hash: "0ad1e32d59aaf4129f6c1e761bc782d93d1a12b54...",
  pan_masked: "ABCDE****",
  scheme_name: "Pradhan Mantri Awas Yojana",
  status: "pending",
  createdAt: "2025-10-07T09:30:00.000Z",
  attempts: 1,
  __v: 0
    });

    await sampleApplication.save();
    console.log("sample was saved");
    res.send("successful testing");
});*/

app.get("/dashboard", async (req, res) => {
  const total = await Application.countDocuments();
  const fraud = await Application.countDocuments({ fraud: true });
  const blocks = chain.chain.length;

  res.render("dashboard/dashboard", { total, fraud, blocks });
});

//blockchain

app.get("/blockchain", (req, res) => {
    res.json(chain.chain);
});

app.post(
    "/applications",
    upload.fields([
        { name: "aadhaarFile", maxCount: 1 },
        { name: "panFile", maxCount: 1 }
    ]),
    async (req, res) => {

        try {

            // CHECK FOR DUPLICATE AADHAAR / PAN
            const duplicateFound = chain.chain.some(block =>
                block.data?.aadhaar_no === req.body.application.aadhaar_no ||
                block.data?.pan_no === req.body.application.pan_no
            );

            if (duplicateFound) {
                req.flash("error", "Duplicate Aadhaar or PAN detected! Fraud suspected.");
                return res.redirect("/applications/new");
            }

            // HASH VALUES (for file integrity only)
            const aadhaarHash = Date.now() + "-" + req.files["aadhaarFile"][0].filename;
            const panHash = Date.now() + "-" + req.files["panFile"][0].filename;

            // ADD BLOCK
            chain.addBlock(
                new Block(
                    chain.chain.length,
                    Date.now().toString(),
                    {
                        aadhaar_no: req.body.application.aadhaar_no,
                        pan_no: req.body.application.pan_no,
                        aadhaar_hash: aadhaarHash,
                        pan_hash: panHash
                    }
                )
            );

            // SAVE TO DB
            const newApplication = new Application({
                name: req.body.application.name,
                email: req.body.application.email,
                phone: req.body.application.phone,
                aadhaar_no: req.body.application.aadhaar_no,
                pan_no: req.body.application.pan_no,
                aadhaarFile: req.files["aadhaarFile"][0].filename,
                panFile: req.files["panFile"][0].filename
            });

            await newApplication.save();

            req.flash("success", "Application submitted successfully!");
            res.redirect("/applications");

        } catch (err) {
            console.error("ERROR:", err);
            req.flash("error", "Something went wrong");
            res.redirect("/applications/new");
        }
    }
);

app.listen(8080, () => {
    console.log("Server is listening to port 8080");
});