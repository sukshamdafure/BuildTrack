const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Notification recipient is required"]
        },

        type: {
            type: String,
            required: [true, "Notification type is required"],
            enum: {
                values: [
                    "TASK_ASSIGNED",
    "TASK_DEADLINE_APPROACHING",
    "TASK_OVERDUE",
    "TASK_COMPLETED",
    "PROGRESS_UPDATE_APPROVED",
    "PROGRESS_UPDATE_REJECTED",
    "MILESTONE_COMPLETED",
    "MILESTONE_DELAYED",
    "LOW_MATERIAL_STOCK",
    "PROJECT_UPDATE",
    "GENERAL"

                ],
                message: "Invalid notification type"
            }
        },

        title: {
            type: String,
            required: [true, "Notification title is required"],
            trim: true,
            maxlength: [
                150,
                "Notification title cannot exceed 150 characters"
            ]
        },

        message: {
            type: String,
            required: [true, "Notification message is required"],
            trim: true,
            maxlength: [
                500,
                "Notification message cannot exceed 500 characters"
            ]
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null
        },

        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            default: null
        },

        milestone: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Milestone",
            default: null
        },
        dedupeKey: {
    type: String,
    trim: true
},

        isRead: {
            type: Boolean,
            default: false
        },

        readAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);
notificationSchema.index(
    { dedupeKey: 1 },
    { unique: true, sparse: true }
);

const Notification = mongoose.model(
    "Notification",
    notificationSchema
);

module.exports = Notification;