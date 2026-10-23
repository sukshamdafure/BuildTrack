const express = require("express");

const router = express.Router();

const {
  getEngineerDailyReports,
  getEngineerDailyReportDetails,
  reviewEngineerDailyReport,
  downloadEngineerDailyReportPdf,
} = require("../controllers/engineerDailyReportController");
const {
  getEngineerMilestones,
  showCreateMilestoneForm,
  createEngineerMilestone,
  showEditMilestoneForm,
  updateEngineerMilestone
} = require("../controllers/engineerMilestoneController");

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

// Engineer-only daily report pages.
router.get(
  "/daily-reports",
  requireAuth,
  requireRole("ENGINEER"),
  getEngineerDailyReports
);

router.get(
  "/daily-reports/:reportId",
  requireAuth,
  requireRole("ENGINEER"),
  getEngineerDailyReportDetails
);

router.post(
  "/daily-reports/:reportId/review",
  requireAuth,
  requireRole("ENGINEER"),
  reviewEngineerDailyReport
);

// Engineer-only milestone management.
router.get(
  "/milestones",
  requireAuth,
  requireRole("ENGINEER"),
  getEngineerMilestones
);

router.get(
  "/milestones/new",
  requireAuth,
  requireRole("ENGINEER"),
  showCreateMilestoneForm
);

router.post(
  "/milestones",
  requireAuth,
  requireRole("ENGINEER"),
  createEngineerMilestone
);

router.get(
  "/milestones/:milestoneId/edit",
  requireAuth,
  requireRole("ENGINEER"),
  showEditMilestoneForm
);

router.post(
  "/milestones/:milestoneId",
  requireAuth,
  requireRole("ENGINEER"),
  updateEngineerMilestone
);

router.get(
    "/daily-reports/:reportId/pdf",
    requireAuth,
    requireRole("ENGINEER"),
    downloadEngineerDailyReportPdf
);

module.exports = router;