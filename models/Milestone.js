const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: [true, "Project is required"]
        },

        name: {
            type: String,
            required: [true, "Milestone name is required"],
            trim: true,
            minlength: [
                3,
                "Milestone name must contain at least 3 characters"
            ],
            maxlength: [
                150,
                "Milestone name cannot exceed 150 characters"
            ]
        },

        description: {
            type: String,
            trim: true,
            maxlength: [
                1000,
                "Description cannot exceed 1000 characters"
            ]
        },

        targetDate: {
            type: Date,
            required: [true, "Target date is required"]
        },

        completionDate: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: {
                values: [
                    "UPCOMING",
                    "IN_PROGRESS",
                    "COMPLETED",
                    "DELAYED"
                ],
                message: "Invalid milestone status"
            },
            default: "UPCOMING"
        },

        progress: {
            type: Number,
            default: 0,
            min: [0, "Progress cannot be below 0"],
            max: [100, "Progress cannot exceed 100"]
        },

        remarks: {
            type: String,
            trim: true,
            maxlength: [
                1000,
                "Remarks cannot exceed 1000 characters"
            ]
        }
    },
    {
        timestamps: true
    }
);

const Milestone = mongoose.model(
    "Milestone",
    milestoneSchema
);

module.exports = Milestone;