const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Notification = require("../models/Notification");
const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");

dotenv.config();

const testNotification = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected");

        const worker = await User.findOne({
            role: "WORKER"
        });

        if (!worker) {
            throw new Error(
                "Worker not found. Create a worker first."
            );
        }

        const project = await Project.findOne({
            name: "ABC Residential Building"
        });

        if (!project) {
            throw new Error(
                "Project not found. Run testProject.js first."
            );
        }

        const task = await Task.findOne({
            project: project._id,
            name: "Foundation Excavation"
        });

        if (!task) {
            throw new Error(
                "Task not found. Run testTask.js first."
            );
        }

        const notification = await Notification.create({
            recipient: worker._id,

            type: "TASK_ASSIGNED",

            title: "New Task Assigned",

            message:
                "Foundation Excavation has been assigned to you.",

            project: project._id,

            task: task._id,

            isRead: false
        });

        console.log(
            "Notification created successfully:"
        );

        console.log(notification);

    } catch (error) {
        console.error("Error:");
        console.error(error.message);

    } finally {
        await mongoose.connection.close();
    }
};

testNotification();