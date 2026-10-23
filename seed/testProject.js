const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("../models/User");
const Project = require("../models/Project");

dotenv.config();

const testProject = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected.");

        // Find an existing engineer
        const engineer = await User.findOne({
            role: "ENGINEER"
        });

        // Find an existing client
        const client = await User.findOne({
            role: "CLIENT"
        });

        if (!engineer || !client) {
            console.log(
                "Engineer or Client user not found."
            );

            console.log(
                "Create an Engineer and Client user before testing the Project model."
            );

            await mongoose.connection.close();

            return;
        }

        const project = await Project.create({
            name: "ABC Residential Building",

            client: client._id,

            engineer: engineer._id,

            siteLocation:
                "Wakad, Pune, Maharashtra",

            description:
                "Residential building construction project.",

            projectType:
                "Residential Building",

            startDate:
                new Date("2026-09-01"),

            expectedCompletionDate:
                new Date("2026-12-20"),

            budget:
                2500000,

            status:
                "PLANNING",

            progress:
                0
        });

        console.log(
            "Project created successfully:"
        );

        console.log(project);

        await mongoose.connection.close();

        console.log(
            "Database connection closed."
        );

    } catch (error) {

        console.error(
            "Error creating project:"
        );

        console.error(
            error.message
        );

        await mongoose.connection.close();
    }
};

testProject();