const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Project name is required"],
            trim: true,
            minlength: [3, "Project name must contain at least 3 characters"],
            maxlength: [150, "Project name cannot exceed 150 characters"]
        },

        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Client is required"]
        },

        engineer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Engineer is required"]
        },

        siteLocation: {
            type: String,
            required: [true, "Site location is required"],
            trim: true
        },

        description: {
            type: String,
            trim: true,
            maxlength: [1000, "Description cannot exceed 1000 characters"]
        },

        projectType: {
            type: String,
            required: [true, "Project type is required"],
            trim: true
        },

        startDate: {
            type: Date,
            required: [true, "Project start date is required"]
        },

        expectedCompletionDate: {
            type: Date,
            required: [true, "Expected completion date is required"]
        },

        budget: {
            type: Number,
            required: [true, "Project budget is required"],
            min: [0, "Budget cannot be negative"]
        },

        status: {
            type: String,
            enum: {
                values: [
                    "PLANNING",
                    "ACTIVE",
                    "ON_HOLD",
                    "COMPLETED",
                    "CANCELLED"
                ],
                message: "Invalid project status"
            },
            default: "PLANNING"
        },

        progress: {
            type: Number,
            default: 0,
            min: [0, "Progress cannot be below 0"],
            max: [100, "Progress cannot exceed 100"]
        }
    },

    {
        timestamps: true
    }
);

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;