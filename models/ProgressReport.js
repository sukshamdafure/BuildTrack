const mongoose = require("mongoose");

const progressReportSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: [true, "Project is required"]
        },

        date: {
            type: Date,
            required: [true, "Report date is required"],
            default: Date.now
        },

        submittedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Report submitter is required"]
        },

        workPerformed: {
            type: String,
            required: [true, "Work performed is required"],
            trim: true,
            maxlength: [
                2000,
                "Work performed cannot exceed 2000 characters"
            ]
        },

        workerCount: {
            type: Number,
            required: [true, "Worker count is required"],
            min: [0, "Worker count cannot be negative"]
        },

        progress: {
            type: Number,
            required: [true, "Progress is required"],
            min: [0, "Progress cannot be below 0"],
            max: [100, "Progress cannot exceed 100"]
        },

        materialsUsed: [
            {
                material: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Material",
                    required: true
                },

                quantity: {
                    type: Number,
                    required: true,
                    min: [0, "Material quantity cannot be negative"]
                }
            }
        ],

        issues: {
            type: String,
            trim: true,
            maxlength: [
                2000,
                "Issues cannot exceed 2000 characters"
            ]
        },

        remarks: {
            type: String,
            trim: true,
            maxlength: [
                2000,
                "Remarks cannot exceed 2000 characters"
            ]
        },

        sitePhotos: [
            {
                type: String,
                trim: true
            }
        ]
    },
    {
        timestamps: true
    }
);

const ProgressReport = mongoose.model(
    "ProgressReport",
    progressReportSchema
);

module.exports = ProgressReport;