const express = require("express");

const {
    requireAuth
} = require("../middleware/authMiddleware");

const {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
} = require("../controllers/notificationController");

const router = express.Router();

router.get(
    "/",
    requireAuth,
    getNotifications
);

router.post(
    "/read-all",
    requireAuth,
    markAllNotificationsRead
);

router.post(
    "/:notificationId/read",
    requireAuth,
    markNotificationRead
);

module.exports = router;