const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: [true, "Project is required"]
        },

        name: {
            type: String,
            required: [true, "Task name is required"],
            trim: true,
            minlength: [3, "Task name must contain at least 3 characters"],
            maxlength: [150, "Task name cannot exceed 150 characters"]
        },

        description: {
            type: String,
            trim: true,
            maxlength: [1000, "Description cannot exceed 1000 characters"]
        },

        assignedWorkers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        startDate: {
            type: Date,
            required: [true, "Task start date is required"]
        },

        deadline: {
            type: Date,
            required: [true, "Task deadline is required"]
        },

        priority: {
            type: String,
            enum: {
                values: [
                    "LOW",
                    "MEDIUM",
                    "HIGH",
                    "CRITICAL"
                ],
                message: "Invalid task priority"
            },
            default: "MEDIUM"
        },

        status: {
            type: String,
            enum: {
                values: [
                    "NOT_STARTED",
                    "IN_PROGRESS",
                    "COMPLETED",
                    "DELAYED",
                    "ON_HOLD"
                ],
                message: "Invalid task status"
            },
            default: "NOT_STARTED"
        },

        progress: {
            type: Number,
            default: 0,
            min: [0, "Progress cannot be below 0"],
            max: [100, "Progress cannot exceed 100"]
        },

        weight: {
            type: Number,
            required: [true, "Task weight is required"],
            min: [0, "Task weight cannot be negative"],
            max: [100, "Task weight cannot exceed 100"]
        },

        estimatedDuration: {
            type: Number,
            min: [0, "Duration cannot be negative"]
        },

        actualCompletionDate: {
            type: Date,
            default: null
        },

        dependencies: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Task"
            }
        ],

        remarks: {
            type: String,
            trim: true,
            maxlength: [1000, "Remarks cannot exceed 1000 characters"]
        }
    },

    {
        timestamps: true
    }
);

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;