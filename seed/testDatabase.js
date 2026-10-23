const mongoose = require("mongoose");
const dotenv = require("dotenv");

const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Material = require("../models/Material");
const Expense = require("../models/Expense");
const ProgressReport = require("../models/ProgressReport");
const Milestone = require("../models/Milestone");
const Notification = require("../models/Notification");

dotenv.config();

const testDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("\n=================================");
        console.log("MongoDB Integration Test");
        console.log("=================================\n");

        // --------------------------------------------------
        // 1. USER
        // --------------------------------------------------

        const engineer = await User.findOne({
            role: "ENGINEER"
        });

        const worker = await User.findOne({
            role: "WORKER"
        });

        const client = await User.findOne({
            role: "CLIENT"
        });

        if (!engineer) {
            throw new Error("Engineer not found");
        }

        if (!worker) {
            throw new Error("Worker not found");
        }

        if (!client) {
            throw new Error("Client not found");
        }

        console.log("✓ Users found");


        // --------------------------------------------------
        // 2. PROJECT + USER RELATIONSHIPS
        // --------------------------------------------------

        const project = await Project.findOne({
            name: "ABC Residential Building"
        })
            .populate("client", "name email role")
            .populate("engineer", "name email role");

        if (!project) {
            throw new Error("Project not found");
        }

        console.log("✓ Project found");

        console.log(
            `  Client: ${project.client.name}`
        );

        console.log(
            `  Engineer: ${project.engineer.name}`
        );


        // --------------------------------------------------
        // 3. TASK
        // --------------------------------------------------

        const task = await Task.findOne({
            project: project._id
        })
            .populate(
                "assignedWorkers",
                "name email role"
            )
            .populate(
                "project",
                "name status"
            );

        if (!task) {
            throw new Error("Task not found");
        }

        console.log("✓ Task relationship works");

        console.log(
            `  Task: ${task.name}`
        );

        console.log(
            `  Project: ${task.project.name}`
        );

        console.log(
            `  Assigned workers: ${task.assignedWorkers.length}`
        );


        // --------------------------------------------------
        // 4. MATERIAL
        // --------------------------------------------------

        const material = await Material.findOne({
            project: project._id
        }).populate(
            "project",
            "name status"
        );

        if (!material) {
            throw new Error("Material not found");
        }

        console.log("✓ Material relationship works");

        console.log(
            `  Material: ${material.name}`
        );

        console.log(
            `  Remaining quantity: ${material.remainingQuantity}`
        );


        // --------------------------------------------------
        // 5. EXPENSE
        // --------------------------------------------------

        const expense = await Expense.findOne({
            project: project._id
        })
            .populate(
                "project",
                "name budget"
            )
            .populate(
                "recordedBy",
                "name email role"
            );

        if (!expense) {
            throw new Error("Expense not found");
        }

        console.log("✓ Expense relationship works");

        console.log(
            `  Amount: ₹${expense.amount}`
        );

        console.log(
            `  Recorded by: ${expense.recordedBy.name}`
        );


        // --------------------------------------------------
        // 6. PROGRESS REPORT
        // --------------------------------------------------

        const progressReport =
            await ProgressReport.findOne({
                project: project._id
            })
                .populate(
                    "project",
                    "name status"
                )
                .populate(
                    "submittedBy",
                    "name email role"
                )
                .populate(
                    "materialsUsed.material",
                    "name unit remainingQuantity"
                );

        if (!progressReport) {
            throw new Error(
                "Progress report not found"
            );
        }

        console.log(
            "✓ Progress report relationships work"
        );

        console.log(
            `  Submitted by: ${progressReport.submittedBy.name}`
        );

        console.log(
            `  Worker count: ${progressReport.workerCount}`
        );

        console.log(
            `  Progress: ${progressReport.progress}%`
        );

        console.log(
            `  Materials used: ${progressReport.materialsUsed.length}`
        );


        // --------------------------------------------------
        // 7. MILESTONE
        // --------------------------------------------------

        const milestone =
            await Milestone.findOne({
                project: project._id
            }).populate(
                "project",
                "name status"
            );

        if (!milestone) {
            throw new Error("Milestone not found");
        }

        console.log("✓ Milestone relationship works");

        console.log(
            `  Milestone: ${milestone.name}`
        );

        console.log(
            `  Progress: ${milestone.progress}%`
        );


        // --------------------------------------------------
        // 8. NOTIFICATION
        // --------------------------------------------------

        const notification =
            await Notification.findOne({
                project: project._id
            })
                .populate(
                    "recipient",
                    "name email role"
                )
                .populate(
                    "project",
                    "name"
                )
                .populate(
                    "task",
                    "name status"
                );

        if (!notification) {
            throw new Error(
                "Notification not found"
            );
        }

        console.log(
            "✓ Notification relationships work"
        );

        console.log(
            `  Recipient: ${notification.recipient.name}`
        );

        console.log(
            `  Type: ${notification.type}`
        );


        // --------------------------------------------------
        // FINAL RESULT
        // --------------------------------------------------

        console.log("\n=================================");
        console.log("DATABASE TEST PASSED ✓");
        console.log("=================================\n");

    } catch (error) {
        console.error("\n=================================");
        console.error("DATABASE TEST FAILED ✗");
        console.error("=================================\n");

        console.error(error.message);

    } finally {
        await mongoose.connection.close();
    }
};

testDatabase();