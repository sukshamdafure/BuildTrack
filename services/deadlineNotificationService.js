const Task = require("../models/Task");
const Notification = require("../models/Notification");

const {
    getTaskDeadlineStatus
} = require("./deadlineService");

let isCheckRunning = false;
let schedulerStarted = false;

const createDeadlineNotification = async ({
    task,
    recipientId,
    type,
    title,
    message,
    deadline
}) => {
    // The key identifies the task, deadline, alert type and recipient.
    const dedupeKey = [
        "task",
        task._id.toString(),
        deadline.getTime(),
        type,
        recipientId.toString()
    ].join(":");

    try {
        await Notification.updateOne(
            { dedupeKey },
            {
                $setOnInsert: {
                    recipient: recipientId,
                    type,
                    title,
                    message,
                    project: task.project._id,
                    task: task._id,
                    dedupeKey,
                    isRead: false
                }
            },
            { upsert: true }
        );
    } catch (error) {
        // A concurrent check may attempt the same unique key.
        if (error.code === 11000) {
            return;
        }

        throw error;
    }
};

const runDeadlineNotificationCheck = async () => {
    // Prevent overlapping checks within this Node.js process.
    if (isCheckRunning) {
        return;
    }

    isCheckRunning = true;

    try {
        const tasks = await Task.find({
            status: { $ne: "COMPLETED" },
            progress: { $lt: 100 }
        })
            .populate("project", "name engineer")
            .populate("assignedWorkers", "name");

        for (const task of tasks) {
            if (
                !task.project ||
                !task.project.engineer ||
                !task.deadline
            ) {
                continue;
            }

            const deadline = new Date(task.deadline);

            if (Number.isNaN(deadline.getTime())) {
                continue;
            }

            const deadlineStatus = getTaskDeadlineStatus(task);

            let type;
            let title;
            let message;

            if (deadlineStatus === "APPROACHING") {
                type = "TASK_DEADLINE_APPROACHING";
                title = "Task deadline approaching";
                message =
                    `"${task.name}" is due on ` +
                    `${deadline.toLocaleDateString("en-IN")}.`;
            } else if (deadlineStatus === "OVERDUE") {
                type = "TASK_OVERDUE";
                title = "Task overdue";
                message =
                    `"${task.name}" passed its deadline on ` +
                    `${deadline.toLocaleDateString("en-IN")}.`;
            } else {
                continue;
            }

            // Notify the engineer and assigned workers.
            const recipientIds = new Map();

            recipientIds.set(
                task.project.engineer.toString(),
                task.project.engineer
            );

            for (const worker of task.assignedWorkers || []) {
                if (worker && worker._id) {
                    recipientIds.set(
                        worker._id.toString(),
                        worker._id
                    );
                }
            }

            for (const recipientId of recipientIds.values()) {
                await createDeadlineNotification({
                    task,
                    recipientId,
                    type,
                    title,
                    message,
                    deadline
                });
            }
        }

        console.log(
            `Deadline notification check completed for ${tasks.length} tasks.`
        );
    } catch (error) {
        console.error(
            "Deadline notification check failed:",
            error.message
        );
    } finally {
        isCheckRunning = false;
    }
};

const startDeadlineNotificationScheduler = () => {
    if (schedulerStarted) {
        return;
    }

    schedulerStarted = true;

    // Run one check at startup.
    runDeadlineNotificationCheck();

    // Then check again every hour.
    setInterval(() => {
        runDeadlineNotificationCheck();
    }, 60 * 60 * 1000);

    console.log("Deadline notification scheduler started.");
};

module.exports = {
    runDeadlineNotificationCheck,
    startDeadlineNotificationScheduler
};