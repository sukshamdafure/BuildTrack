const express = require("express");

const {
    getEngineerDashboard,
    getWorkerDashboard,
    getAdminDashboard
} = require("../controllers/dashboardController");

const {
    getClientDashboard
} = require("../controllers/clientDashboardController");
const {
    requireAuth
} = require("../middleware/authMiddleware");

const {
    requireRole
} = require("../middleware/roleMiddleware");

const router = express.Router();


// ==========================================
// ENGINEER DASHBOARD
// ==========================================

router.get(
    "/engineer/dashboard",
    requireAuth,
    requireRole("ENGINEER", "ADMIN"),
    getEngineerDashboard
);


// ==========================================
// WORKER DASHBOARD
// ==========================================

router.get(
    "/worker/dashboard",
    requireAuth,
    requireRole("WORKER"),
    getWorkerDashboard
);


// ==========================================
// CLIENT DASHBOARD
// ==========================================

router.get(
    "/client/dashboard",
    requireAuth,
    requireRole("CLIENT"),
    getClientDashboard
);


// ==========================================
// ADMIN DASHBOARD
// ==========================================

router.get(
    "/admin/dashboard",
    requireAuth,
    requireRole("ADMIN"),
    getAdminDashboard
);


module.exports = router;