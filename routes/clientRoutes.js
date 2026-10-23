const express = require("express");
const router = express.Router();

const {
  getClientDashboard,
  getClientProjectDetails,
  getClientProjects,
  getClientProgress,
  getClientReports,
  getClientReportDetails,
  getClientMilestones
} = require("../controllers/clientDashboardController");

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

// app.js already mounts this router at "/client".
router.get(
  "/",
  requireAuth,
  requireRole("CLIENT"),
  getClientDashboard
);
router.get(
  "/projects/:projectId",
  requireAuth,
  requireRole("CLIENT"),
  getClientProjectDetails
);
router.get(
  "/projects",
  requireAuth,
  requireRole("CLIENT"),
  getClientProjects
);
router.get(
  "/progress",
  requireAuth,
  requireRole("CLIENT"),
  getClientProgress
);
router.get(
  "/reports",
  requireAuth,
  requireRole("CLIENT"),
  getClientReports
);

router.get(
  "/reports",
  requireAuth,
  requireRole("CLIENT"),
  getClientReports
);

router.get(
  "/reports/:reportId",
  requireAuth,
  requireRole("CLIENT"),
  getClientReportDetails
);

router.get(
  "/milestones",
  requireAuth,
  requireRole("CLIENT"),
  getClientMilestones
);

module.exports = router;