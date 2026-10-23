const mongoose = require("mongoose");
const dotenv = require("dotenv");

const ProgressReport = require("../models/ProgressReport");
const Project = require("../models/Project");
const User = require("../models/User");
const Material = require("../models/Material");

dotenv.config();

const testProgressReport = async () => {
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

        const cement = await Material.findOne({
            project: project._id,
            name: "Cement"
        });

        if (!cement) {
            throw new Error(
                "Cement material not found. Run testMaterial.js first."
            );
        }

        const report = await ProgressReport.create({
            project: project._id,
            date: new Date(),
            submittedBy: engineer._id,

            workPerformed:
                "Foundation excavation was completed for the northern section.",

            workerCount: 18,

            progress: 8,

            materialsUsed: [
                {
                    material: cement._id,
                    quantity: 30
                }
            ],

            issues:
                "Heavy rainfall caused a minor delay in excavation work.",

            remarks:
                "Work will continue from the northern section tomorrow.",

            sitePhotos: []
        });

        console.log("Progress report created successfully:");
        console.log(report);

    } catch (error) {
        console.error("Error:");
        console.error(error.message);

    } finally {
        await mongoose.connection.close();
    }
};

testProgressReport();