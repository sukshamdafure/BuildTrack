
const express = require("express");
const router = express.Router();
const upload = require("../middleware/photoUpload");

const {
    getWorkerDashboard,
    getWorkerTasks,
    getWorkerTaskDetails,
    getWorkerProgressForm,
    submitWorkerProgress,
    getDailyWorkReportForm,
    submitDailyWorkReport,
    getWorkerReports,
getWorkerProgressUpdates,
} = require("../controllers/workerController");

const {
    requireAuth
} = require("../middleware/authMiddleware");

const {
    requireRole
} = require("../middleware/roleMiddleware");

// ==========================================
// WORKER DASHBOARD
// ==========================================

router.get(
    "/dashboard",
    requireAuth,
    requireRole("WORKER"),
    getWorkerDashboard
);
router.get(
    "/tasks",
    requireAuth,
    requireRole("WORKER"),
    getWorkerTasks
);
router.get(
    "/tasks/:taskId",
    requireAuth,
    requireRole("WORKER"),
    getWorkerTaskDetails
);


router.get(
    "/tasks/:taskId/progress",
    requireAuth,
    requireRole("WORKER"),
    getWorkerProgressForm
);

router.post(
    "/tasks/:taskId/progress",
    requireAuth,
    requireRole("WORKER"),
    submitWorkerProgress
);


router.get(
    "/tasks/:taskId/daily-report",
    requireAuth,
    requireRole("WORKER"),
    getDailyWorkReportForm
);


router.post(
    "/tasks/:taskId/daily-report",
    requireAuth,
    requireRole("WORKER"),
    upload.array("photos", 5),
    submitDailyWorkReport
);


// ==========================================
// WORKER DAILY REPORT HISTORY
// ==========================================

router.get(
    "/reports",
    requireAuth,
    requireRole("WORKER"),
    getWorkerReports
);


// ==========================================
// WORKER PROGRESS HISTORY
// ==========================================

router.get(
    "/progress",
    requireAuth,
    requireRole("WORKER"),
    getWorkerProgressUpdates
);

module.exports = router;
