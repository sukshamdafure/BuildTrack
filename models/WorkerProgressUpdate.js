
const mongoose = require("mongoose");

const workerProgressUpdateSchema = new mongoose.Schema(
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

        previousProgress: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },

        proposedProgress: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },

        remarks: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        
status: {
    type: String,
    enum: [
        "PENDING",
        "REVIEWING",
        "APPROVED",
        "REJECTED"
    ],
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
        }
    },
    {
        timestamps: true
    }
);

workerProgressUpdateSchema.index({
    task: 1,
    createdAt: -1
});

module.exports = mongoose.model(
    "WorkerProgressUpdate",
    workerProgressUpdateSchema
);
