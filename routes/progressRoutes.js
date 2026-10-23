
const express = require("express");
const router = express.Router();

const {
    getProgressReviews,
    approveProgressUpdate,
    rejectProgressUpdate
} = require("../controllers/progressController");

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get(
    "/engineer/progress-reviews",
    requireAuth,
    requireRole("ENGINEER"),
    getProgressReviews
);

router.post(
    "/engineer/progress-reviews/:updateId/approve",
    requireAuth,
    requireRole("ENGINEER"),
    approveProgressUpdate
);

router.post(
    "/engineer/progress-reviews/:updateId/reject",
    requireAuth,
    requireRole("ENGINEER"),
    rejectProgressUpdate
);

module.exports = router;
