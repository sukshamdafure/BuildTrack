const dns = require("node:dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const session = require("express-session");

// Load environment variables before importing application modules.
dotenv.config();

const connectDB = require("./config/db");
const {
    startDeadlineNotificationScheduler
} = require("./services/deadlineNotificationService");
const { default: MongoStore } = require("connect-mongo");

const { loadCurrentUser } = require("./middleware/userMiddleware");

// Route imports
const progressRoutes = require("./routes/progressRoutes");
const engineerDailyReportRoutes = require("./routes/engineerDailyReportRoutes");
const clientRoutes = require("./routes/clientRoutes");
const Notification = require("./models/Notification");



const app = express();

// ==========================================
// DATABASE
// ==========================================

// MongoDB will be connected before the server starts.

// ==========================================
// VIEW ENGINE
// ==========================================

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// SESSION
// ==========================================

app.use(
  session({
    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// ==========================================
// CURRENT USER
// ==========================================

app.use(loadCurrentUser);

app.use(async (req, res, next) => {
    res.locals.currentUser = req.user || null;
    res.locals.currentPath = req.path;
    res.locals.unreadNotificationCount = 0;

    if (req.user && req.user._id) {
        try {
            res.locals.unreadNotificationCount =
                await Notification.countDocuments({
                    recipient: req.user._id,
                    isRead: false
                });
        } catch (error) {
            console.error(
                "Unread notification count error:",
                error.message
            );
        }
    }

    next();
});

// ==========================================
// ROUTES
// ==========================================

// Home page
app.get("/", (req, res) => {
  res.render("home");
});

// Authentication
app.use("/", require("./routes/authRoutes"));

// ==========================================
// ROLE-SPECIFIC ROUTES
// Register these BEFORE the general dashboard router.
// ==========================================

// Worker routes
app.use("/worker", require("./routes/workerRoutes"));

// Engineer progress verification
app.use("/", progressRoutes);

// Engineer daily reports
app.use("/engineer", engineerDailyReportRoutes);

// Client dashboard
// IMPORTANT: Must be registered before dashboardRoutes.
app.use("/client", clientRoutes);


// ==========================================
// GENERAL APPLICATION ROUTES
// ==========================================

app.use("/", require("./routes/dashboardRoutes"));

app.use("/", require("./routes/projectRoutes"));

app.use("/", require("./routes/taskRoutes"));

app.use("/", require("./routes/materialRoutes"));

app.use("/", require("./routes/expenseRoutes"));

app.use("/notifications", require("./routes/notificationRoutes"));

// ==========================================
// 404
// ==========================================

app.use((req, res) => {
  res.status(404).render("404");
});

// ==========================================
// SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

const startApplication = async () => {
    try {
        await connectDB();

        // Start periodic task deadline notifications after MongoDB connects.
        startDeadlineNotificationScheduler();

        app.listen(PORT, () => {
            console.log(
                `BuildTrack running on http://localhost:${PORT}`
            );
        });
    } catch (error) {
        console.error(
            "Failed to start BuildTrack:",
            error.message
        );

        process.exit(1);
    }
};

startApplication();