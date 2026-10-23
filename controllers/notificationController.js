const mongoose = require("mongoose");
const Notification = require("../models/Notification");

// Show notifications belonging only to the logged-in user.
const getNotifications = async (req, res) => {
    try {
        const recipientId = req.user._id;

        const [notifications, unreadCount] = await Promise.all([
            Notification.find({ recipient: recipientId })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean(),

            Notification.countDocuments({
                recipient: recipientId,
                isRead: false
            })
        ]);

        res.render("notifications/index", {
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error("Load notifications error:", error.message);
        res.status(500).send("Unable to load notifications.");
    }
};

// Mark one of the logged-in user's notifications as read.
const markNotificationRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        if (!mongoose.isValidObjectId(notificationId)) {
            return res.status(400).send("Invalid notification ID.");
        }

        await Notification.findOneAndUpdate(
            {
                _id: notificationId,
                recipient: req.user._id
            },
            {
                $set: {
                    isRead: true,
                    readAt: new Date()
                }
            }
        );

        return res.redirect("/notifications");
    } catch (error) {
        console.error("Mark notification read error:", error.message);
        res.status(500).send("Unable to update notification.");
    }
};

// Mark all of the logged-in user's notifications as read.
const markAllNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            {
                recipient: req.user._id,
                isRead: false
            },
            {
                $set: {
                    isRead: true,
                    readAt: new Date()
                }
            }
        );

        return res.redirect("/notifications");
    } catch (error) {
        console.error("Mark all notifications read error:", error.message);
        res.status(500).send("Unable to update notifications.");
    }
};

module.exports = {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
};