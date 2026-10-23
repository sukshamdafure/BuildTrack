
const mongoose = require("mongoose");

const WorkerProgressUpdate = require("../models/WorkerProgressUpdate");
const Notification = require("../models/Notification");
const Task = require("../models/Task");
const Project = require("../models/Project");

const { updateProjectProgress } = require("../services/progressService");
const { validateTaskState } = require("../utils/taskRules");

// Show pending worker progress submissions assigned to the logged-in engineer
const getProgressReviews = async (req, res) => {
    try {
        const projects = await Project.find({
            engineer: req.user._id
        }).select("_id");

        const projectIds = projects.map(project => project._id);

        const updates = await WorkerProgressUpdate.find({
            project: { $in: projectIds },
            status: "PENDING"
        })
            .populate("worker", "name email")
            .populate("project", "name")
            .populate("task", "title progress status")
            .sort({ createdAt: 1 });

        
return res.render("engineer/progress-reviews", {
    submissions: updates,
    error: null,
    success: null
});

    } catch (error) {
        console.error("Error loading progress reviews:", error);

        return res.status(500).render("error", {
            message: "Unable to load progress reviews."
        });
    }
};
const notifyProgressReview = async (update, reviewStatus) => {
    const isApproved = reviewStatus === "APPROVED";

    const type = isApproved
        ? "PROGRESS_UPDATE_APPROVED"
        : "PROGRESS_UPDATE_REJECTED";

    const title = isApproved
        ? "Progress update approved"
        : "Progress update rejected";

    try {
        const task = await Task.findById(update.task)
            .select("name");

        const taskName = task?.name || "your assigned task";

        const dedupeKey = [
            type,
            update._id.toString(),
            update.worker.toString()
        ].join(":");

        await Notification.updateOne(
            { dedupeKey },
            {
                $setOnInsert: {
                    recipient: update.worker,
                    type,
                    title,
                    message: `Your progress update for "${taskName}" was ${isApproved ? "approved" : "rejected"} by the engineer.`,
                    project: update.project,
                    task: update.task,
                    dedupeKey,
                    isRead: false
                }
            },
            { upsert: true }
        );
    } catch (error) {
        // Notification failures must not undo a successful review.
        console.error(
            "Progress review notification error:",
            error.message
        );
    }
};

// Approve a worker's progress submission
const approveProgressUpdate = async (req, res) => {
    const { updateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(updateId)) {
        return res.status(400).send("Invalid progress update ID.");
    }

    let update;
    let taskChanged = false;
    let previousTaskProgress;

    try {
        // Only retrieve submissions belonging to this engineer's projects
        update = await WorkerProgressUpdate.findOne({
            _id: updateId,
            status: "PENDING"
        });

        if (!update) {
            return res.status(404).send(
                "Progress update not found or already reviewed."
            );
        }

        const project = await Project.findOne({
            _id: update.project,
            engineer: req.user._id
        });

        if (!project) {
            return res.status(403).send(
                "You are not authorized to review this progress update."
            );
        }

        // Ensure the submission still matches the task's current progress
        const task = await Task.findOne({
            _id: update.task,
            project: update.project,
            assignedWorkers: update.worker,
            progress: update.previousProgress
        });

        if (!task) {
            return res.status(409).send(
                "The task has changed since this submission. Refresh and review the latest progress."
            );
        }

        if (
            !Number.isFinite(update.proposedProgress) ||
            update.proposedProgress < 0 ||
            update.proposedProgress > 100 ||
            update.proposedProgress < task.progress
        ) {
            return res.status(400).send(
                "The proposed progress is invalid."
            );
        }

        // Keep the task's status and progress consistent
        const nextStatus =
            update.proposedProgress === 100 ? "COMPLETED" : task.status;

        const validation = validateTaskState(
    update.proposedProgress,
    nextStatus
);

if (!validation.valid) {
    return res.status(400).send(validation.message);
}

        // Atomically claim the pending submission so it cannot be approved twice
        const claimedUpdate = await WorkerProgressUpdate.findOneAndUpdate(
            {
                _id: update._id,
                status: "PENDING"
            },
            {
                $set: {
                    status: "REVIEWING",
                    reviewedBy: req.user._id,
                    reviewedAt: new Date()
                }
            },
            { new: true }
        );

        if (!claimedUpdate) {
            return res.status(409).send(
                "This progress update is already being reviewed."
            );
        }

        // Recheck the task's progress before changing it
        const changedTask = await Task.findOneAndUpdate(
            {
                _id: task._id,
                project: update.project,
                assignedWorkers: update.worker,
                progress: update.previousProgress
            },
            {
                $set: {
                    progress: update.proposedProgress,
                    status: nextStatus
                }
            },
            { new: true, runValidators: true }
        );

        if (!changedTask) {
            await WorkerProgressUpdate.updateOne(
                { _id: claimedUpdate._id, status: "REVIEWING" },
                {
                    $set: {
                        status: "PENDING",
                        reviewedBy: null,
                        reviewedAt: null
                    }
                }
            );

            return res.status(409).send(
                "The task changed while this update was being approved. Please review it again."
            );
        }

        taskChanged = true;
        previousTaskProgress = task.progress;

        // Recalculate the project's weighted progress using your existing service
        await updateProjectProgress(update.project);

        await WorkerProgressUpdate.updateOne(
            {
                _id: claimedUpdate._id,
                status: "REVIEWING"
            },
            {
                $set: {
                    status: "APPROVED",
                    reviewedBy: req.user._id,
                    reviewedAt: new Date()
                }
            }
);
await notifyProgressReview(claimedUpdate, "APPROVED");

// Notify recipients only when this approval completes the task.
const becameCompleted =
    task.status !== "COMPLETED" &&
    Number(task.progress) < 100 &&
    changedTask.status === "COMPLETED" &&
    Number(changedTask.progress) === 100;

if (becameCompleted) {
    const recipients = new Map();

    // Notify the project client.
    if (project.client) {
        recipients.set(
            project.client.toString(),
            project.client
        );
    }

    // Notify workers assigned to the completed task.
    for (const workerId of changedTask.assignedWorkers || []) {
        const recipientId = workerId._id || workerId;

        if (recipientId) {
            recipients.set(
                recipientId.toString(),
                recipientId
            );
        }
    }

    for (const recipientId of recipients.values()) {
        // Each approved progress update has a stable event ID.
        const dedupeKey = [
            "TASK_COMPLETED",
            changedTask._id.toString(),
            claimedUpdate._id.toString(),
            recipientId.toString()
        ].join(":");

        try {
            await Notification.updateOne(
                { dedupeKey },
                {
                    $setOnInsert: {
                        recipient: recipientId,
                        type: "TASK_COMPLETED",
                        title: "Task completed",
                        message:
                            `The task "${changedTask.name}" in project ` +
                            `"${project.name}" has been completed.`,
                        project: project._id,
                        task: changedTask._id,
                        dedupeKey,
                        isRead: false
                    }
                },
                { upsert: true }
            );
        } catch (notificationError) {
            // A notification failure must not undo an approved update.
            console.error(
                "Task completion notification error:",
                notificationError.message
            );
        }
    }
}

return res.redirect("/engineer/progress-reviews?success=approved");
    } catch (error) {
        console.error("Error approving progress update:", error);

        // Best-effort recovery if the task changed but later processing failed
        if (taskChanged && update) {
            try {
                await Task.updateOne(
                    {
                        _id: update.task,
                        project: update.project,
                        progress: update.proposedProgress
                    },
                    {
                        $set: {
                            progress: previousTaskProgress
                        }
                    }
                );

                await updateProjectProgress(update.project);
            } catch (rollbackError) {
                console.error(
                    "Progress approval recovery failed:",
                    rollbackError
                );
            }
        }

        if (update) {
            await WorkerProgressUpdate.updateOne(
                { _id: update._id, status: "REVIEWING" },
                {
                    $set: {
                        status: "PENDING",
                        reviewedBy: null,
                        reviewedAt: null
                    }
                }
            ).catch(recoveryError => {
                console.error(
                    "Progress review status recovery failed:",
                    recoveryError
                );
            });
        }

        return res.status(500).send(
            "An error occurred while approving this progress update."
        );
    }
};

// Reject a worker's progress submission
const rejectProgressUpdate = async (req, res) => {
    const { updateId } = req.params;
    const { reviewRemarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(updateId)) {
        return res.status(400).send("Invalid progress update ID.");
    }

    try {
        const update = await WorkerProgressUpdate.findOne({
            _id: updateId,
            status: "PENDING"
        });

        if (!update) {
            return res.status(404).send(
                "Progress update not found or already reviewed."
            );
        }

        const project = await Project.findOne({
            _id: update.project,
            engineer: req.user._id
        });

        if (!project) {
            return res.status(403).send(
                "You are not authorized to review this progress update."
            );
        }

        const result = await WorkerProgressUpdate.findOneAndUpdate(
            {
                _id: update._id,
                status: "PENDING"
            },
            {
                $set: {
                    status: "REJECTED",
                    reviewedBy: req.user._id,
                    reviewedAt: new Date(),
                    reviewRemarks:
                        typeof reviewRemarks === "string"
                            ? reviewRemarks.trim().slice(0, 2000)
                            : ""
                }
            },
            { new: true }
        );

        if (!result) {
    return res.status(409).send(
        "This progress update has already been reviewed."
    );
}

await notifyProgressReview(update, "REJECTED");

return res.redirect("/engineer/progress-reviews?success=rejected");
    } catch (error) {
        console.error("Error rejecting progress update:", error);

        return res.status(500).send(
            "An error occurred while rejecting this progress update."
        );
    }
};

module.exports = {
    getProgressReviews,
    approveProgressUpdate,
    rejectProgressUpdate
};
