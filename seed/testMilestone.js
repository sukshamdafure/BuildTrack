const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Milestone = require("../models/Milestone");
const Project = require("../models/Project");

dotenv.config();

const testMilestone = async () => {
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

        const milestone = await Milestone.create({
            project: project._id,

            name: "Foundation Completed",

            description:
                "Complete foundation excavation, reinforcement and concrete work.",

            targetDate: new Date("2026-10-30"),

            status: "IN_PROGRESS",

            progress: 65,

            remarks:
                "Foundation work is progressing as planned."
        });

        console.log("Milestone created successfully:");
        console.log(milestone);

    } catch (error) {
        console.error("Error:");
        console.error(error.message);

    } finally {
        await mongoose.connection.close();
    }
};

testMilestone();