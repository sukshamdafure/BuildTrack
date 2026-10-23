const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Expense = require("../models/Expense");
const Project = require("../models/Project");
const User = require("../models/User");

dotenv.config();

const testExpense = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected");

        const project = await Project.findOne({
            name: "ABC Residential Building"
        });

        if (!project) {
            throw new Error(
                "Project not found. Run testProject.js first."
            );
        }

        const engineer = await User.findOne({
            role: "ENGINEER"
        });

        if (!engineer) {
            throw new Error(
                "Engineer not found. Run testUser.js first."
            );
        }

        const expense = await Expense.create({
            project: project._id,
            category: "MATERIAL",
            amount: 25000,
            description: "Purchase of cement and construction materials",
            date: new Date(),
            recordedBy: engineer._id
        });

        console.log("Expense created successfully:");
        console.log(expense);

    } catch (error) {
        console.error("Error:");
        console.error(error.message);

    } finally {
        await mongoose.connection.close();
    }
};

testExpense();