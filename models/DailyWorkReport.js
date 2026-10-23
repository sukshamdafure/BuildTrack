
const mongoose = require("mongoose");

const dailyWorkReportSchema = new mongoose.Schema(
    {
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: true,
            index: true
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true
        },

        worker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        reportDate: {
            type: Date,
            required: true,
            index: true
        },

        workPerformed: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000
        },

        labourCount: {
            type: Number,
            required: true,
            min: 0,
            max: 10000
        },

        materialsUsed: {
            type: String,
            trim: true,
            maxlength: 3000,
            default: ""
        },

        issues: {
            type: String,
            trim: true,
            maxlength: 3000,
            default: ""
        },

        remarks: {
            type: String,
            trim: true,
            maxlength: 3000,
            default: ""
        },

        status: {
            type: String,
            enum: ["PENDING", "REVIEWED"],
            default: "PENDING",
            index: true
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        reviewedAt: {
            type: Date,
            default: null
        },

        reviewRemarks: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: ""
        },

photos: {
    type: [
        {
            url: {
                type: String,
                required: true
            },

            publicId: {
                type: String,
                required: true
            },

            format: {
                type: String,
                default: ""
            },

            uploadedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    default: [],
    validate: {
        validator: photos => photos.length <= 5,
        message: "A report cannot contain more than 5 photos."
    }
},

    },
    {
        timestamps: true
    },
    
);

dailyWorkReportSchema.index({
    worker: 1,
    reportDate: -1
});

dailyWorkReportSchema.index({
    project: 1,
    reportDate: -1
});

module.exports = mongoose.model(
    "DailyWorkReport",
    dailyWorkReportSchema
);
