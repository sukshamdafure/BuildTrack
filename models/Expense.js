const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: [true, "Project is required"]
        },
        material: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Material"
},

        category: {
            type: String,
            required: [true, "Expense category is required"],
            enum: {
                values: [
                    "MATERIAL",
                    "LABOUR",
                    "EQUIPMENT",
                    "TRANSPORTATION",
                    "OTHER"
                ],
                message: "Invalid expense category"
            }
        },

        amount: {
            type: Number,
            required: [true, "Expense amount is required"],
            min: [0, "Expense amount cannot be negative"]
        },

        description: {
            type: String,
            trim: true,
            maxlength: [
                500,
                "Description cannot exceed 500 characters"
            ]
        },

        date: {
            type: Date,
            required: [true, "Expense date is required"],
            default: Date.now
        },

        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Recorded by user is required"]
        }
    },
    {
        timestamps: true
    }
);

expenseSchema.index(
    { material: 1 },
    { unique: true, sparse: true }
);

const Expense = mongoose.model("Expense", expenseSchema);

module.exports = Expense;