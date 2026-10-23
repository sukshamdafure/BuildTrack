const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");

dotenv.config();

const testTask = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected.");

        const project = await Project.findOne({
            name: "ABC Residential Building"
        });

        if (!project) {
            console.log(
                "Project not found. Create a project first."
            );

            await mongoose.connection.close();

            return;
        }

        const workers = await User.find({
            role: "WORKER"
        }).select("_id name email");

        const task = await Task.create({
            project: project._id,

            name: "Foundation Excavation",

            description:
                "Excavation work for the building foundation.",

            assignedWorkers:
                workers.map(worker => worker._id),

            startDate:
                new Date("2026-09-20"),

            deadline:
                new Date("2026-09-25"),

            priority:
                "HIGH",

            status:
                "IN_PROGRESS",

            progress:
                40,

            weight:
                20,

            estimatedDuration:
                6,

            remarks:
                "Excavation is currently in progress."
        });

        console.log(
            "Task created successfully:"
        );

        console.log(task);

        await mongoose.connection.close();

        console.log(
            "Database connection closed."
        );

    } catch (error) {

        console.error(
            "Error creating task:"
        );

        console.error(
            error.message
        );

        await mongoose.connection.close();
    }
};

testTask();