const Task = require("../models/Task");
const Notification = require("../models/Notification");
const WorkerProgressUpdate = require(
    "../models/WorkerProgressUpdate"
);
const DailyWorkReport = require(
    "../models/DailyWorkReport"
);
const {
    getTaskDeadlineStatus,
    getDaysUntilDeadline
} = require("../services/deadlineService");


const {
    uploadImageBuffer,
    deleteImage
} = require("../services/cloudinaryService");


const getWorkerDashboard = async (req, res) => {
    try {
        const workerId = req.user._id;

        // Retrieve only tasks assigned to the logged-in worker.
        const tasks = await Task.find({
            assignedWorkers: workerId
        })
            .populate("project", "name")
            .sort({ deadline: 1 });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const activeTasks = tasks.filter(
            task => task.status !== "COMPLETED"
        );

        const completedTasks = tasks.filter(
            task =>
                task.status === "COMPLETED" ||
                Number(task.progress) === 100
        );

        const todaysTasks = activeTasks.filter(task => {
            if (!task.startDate || !task.deadline) {
                return false;
            }

            const start = new Date(task.startDate);
            const deadline = new Date(task.deadline);

            return start < tomorrow && deadline >= today;
        });

        const upcomingDeadlines = activeTasks.filter(task => {
            if (!task.deadline) return false;

            const deadline = new Date(task.deadline);

            return deadline >= today && deadline < nextWeek;
        });

        const delayedTasks = activeTasks.filter(task => {
            if (!task.deadline) return false;

            const deadline = new Date(task.deadline);

            return (
                deadline < today ||
                task.status === "DELAYED"
            );
        });

        res.render("worker/dashboard", {
            tasks,
            activeTasks,
            completedTasks,
            todaysTasks,
            upcomingDeadlines,
            delayedTasks
        });

    } catch (error) {
        console.error(
            "Worker dashboard error:",
            error.message
        );

        return res.status(500).send(
            "Failed to load worker dashboard."
        );
    }
};


const getWorkerTasks = async (req, res) => {
    try {
        const {
            status = "ALL",
            priority = "ALL",
            search = ""
        } = req.query;

        const allowedStatuses = [
            "NOT_STARTED",
            "IN_PROGRESS",
            "ON_HOLD",
            "COMPLETED",
            "DELAYED"
        ];

        const allowedPriorities = [
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL"
        ];

        const filter = {
            assignedWorkers: req.user._id
        };

        if (
            status !== "ALL" &&
            allowedStatuses.includes(status)
        ) {
            filter.status = status;
        }

        if (
            priority !== "ALL" &&
            allowedPriorities.includes(priority)
        ) {
            filter.priority = priority;
        }

        if (search.trim()) {
            filter.name = {
                $regex: search.trim().replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                ),
                $options: "i"
            };
        }

        const tasks = await Task.find(filter)
            .populate(
                "project",
                "name siteLocation status expectedCompletionDate"
            )
            .sort({
                deadline: 1,
                startDate: 1
            });

        const taskList = tasks.map(task => ({
            ...task.toObject(),
            deadlineStatus: getTaskDeadlineStatus(task),
            daysUntilDeadline: getDaysUntilDeadline(task)
        }));

        return res.render("worker/my-tasks", {
            tasks: taskList,
            filters: {
                status,
                priority,
                search
            },
            user: req.user
        });

    } catch (error) {
        console.error(
            "Worker tasks error:",
            error.message
        );

        return res.status(500).send(
            "Failed to load your assigned tasks."
        );
    }
};

const getWorkerTaskDetails = async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.taskId,
            assignedWorkers: req.user._id
        })
            .populate(
                "project",
                "name siteLocation status startDate expectedCompletionDate"
            )
            .populate(
                "assignedWorkers",
                "name email"
            )
            .populate(
                "dependencies",
                "name status progress deadline"
            );

        if (!task) {
            return res.status(404).render("404", {
                message: "Task not found or you are not assigned to it."
            });
        }

        const deadlineStatus =
            getTaskDeadlineStatus(task);

        const daysUntilDeadline =
            getDaysUntilDeadline(task);

        return res.render("worker/task-details", {
            task,
            deadlineStatus,
            daysUntilDeadline,
            user: req.user
        });

    } catch (error) {
        console.error(
            "Worker task details error:",
            error.message
        );

        if (error.name === "CastError") {
            return res.status(404).send("Task not found.");
        }

        return res.status(500).send(
            "Failed to load task details."
        );
    }
};


const getWorkerProgressForm = async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.taskId,
            assignedWorkers: req.user._id
        }).populate("project", "name");

        if (!task) {
            return res.status(404).send(
                "Task not found or not assigned to you."
            );
        }

        if (
            task.status === "COMPLETED" ||
            Number(task.progress) === 100
        ) {
            return res.status(400).send(
                "This task is already completed."
            );
        }

        const pendingSubmission =
            await WorkerProgressUpdate.findOne({
                task: task._id,
                worker: req.user._id,
                status: "PENDING"
            }).sort({ createdAt: -1 });

        return res.render("worker/progress-update", {
            task,
            user: req.user,
            pendingSubmission,
            submitted: req.query.submitted === "1"
        });

    } catch (error) {
        console.error(
            "Worker progress form error:",
            error.message
        );

        if (error.name === "CastError") {
            return res.status(404).send("Task not found.");
        }

        return res.status(500).send(
            "Failed to open progress update form."
        );
    }
};


const submitWorkerProgress = async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.taskId,
            assignedWorkers: req.user._id
        });

        if (!task) {
            return res.status(404).send(
                "Task not found or not assigned to you."
            );
        }

        if (
            task.status === "COMPLETED" ||
            Number(task.progress) === 100
        ) {
            return res.status(400).send(
                "This task is already completed."
            );
        }

        const proposedProgress =
            Number(req.body.progress);

        const remarks =
            typeof req.body.remarks === "string"
                ? req.body.remarks.trim()
                : "";

        if (
            req.body.progress === undefined ||
            req.body.progress === "" ||
            !Number.isFinite(proposedProgress) ||
            proposedProgress < 0 ||
            proposedProgress > 100
        ) {
            return res.status(400).send(
                "Progress must be a number between 0 and 100."
            );
        }

        if (
            proposedProgress < Number(task.progress || 0)
        ) {
            return res.status(400).send(
                "Submitted progress cannot be less than the current verified progress."
            );
        }

        if (!remarks) {
            return res.status(400).send(
                "Please provide remarks about the work performed."
            );
        }

        if (remarks.length > 2000) {
            return res.status(400).send(
                "Remarks cannot exceed 2000 characters."
            );
        }

        const pendingSubmission =
            await WorkerProgressUpdate.findOne({
                task: task._id,
                worker: req.user._id,
                status: "PENDING"
            });

        if (pendingSubmission) {
            return res.status(409).send(
                "You already have a pending submission for this task. Wait for the Engineer to review it."
            );
        }

        await WorkerProgressUpdate.create({
            task: task._id,
            project: task.project,
            worker: req.user._id,
            previousProgress: Number(task.progress || 0),
            proposedProgress,
            remarks,
            status: "PENDING"
        });

        return res.redirect(
            `/worker/tasks/${task._id}/progress?submitted=1`
        );

    } catch (error) {
        console.error(
            "Worker progress submission error:",
            error.message
        );

        if (error.name === "CastError") {
            return res.status(404).send("Task not found.");
        }

        return res.status(500).send(
            "Failed to submit progress update."
        );
    }
};


const getDailyWorkReportForm = async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.taskId,
            assignedWorkers: req.user._id
        }).populate("project", "name");

        if (!task) {
            return res.status(404).send(
                "Task not found or not assigned to you."
            );
        }

        if (
            task.status === "COMPLETED" ||
            Number(task.progress) === 100
        ) {
            return res.status(400).send(
                "Daily reports cannot be submitted for a completed task."
            );
        }

        const reports = await DailyWorkReport.find({
            task: task._id,
            worker: req.user._id
        })
            .sort({ reportDate: -1, createdAt: -1 })
            .limit(20);

        return res.render("worker/daily-report-form", {
            task,
            reports,
            user: req.user,
            reqQuerySubmitted: req.query.submitted === "1"
        });

    } catch (error) {
        console.error(
            "Daily report form error:",
            error.message
        );

        if (error.name === "CastError") {
            return res.status(404).send("Task not found.");
        }

        return res.status(500).send(
            "Failed to load daily report form."
        );
    }
};


const submitDailyWorkReport = async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.taskId,
            assignedWorkers: req.user._id
        });

        if (!task) {
            return res.status(404).send(
                "Task not found or not assigned to you."
            );
        }

        if (
            task.status === "COMPLETED" ||
            Number(task.progress) === 100
        ) {
            return res.status(400).send(
                "Daily reports cannot be submitted for a completed task."
            );
        }

        const workPerformed =
            typeof req.body.workPerformed === "string"
                ? req.body.workPerformed.trim()
                : "";

        const materialsUsed =
            typeof req.body.materialsUsed === "string"
                ? req.body.materialsUsed.trim()
                : "";

        const issues =
            typeof req.body.issues === "string"
                ? req.body.issues.trim()
                : "";

        const remarks =
            typeof req.body.remarks === "string"
                ? req.body.remarks.trim()
                : "";

        const labourCount = Number(req.body.labourCount);

        if (
            !req.body.reportDate ||
            !/^\d{4}-\d{2}-\d{2}$/.test(req.body.reportDate)
        ) {
            return res.status(400).send(
                "Please provide a valid report date."
            );
        }

        const [year, month, day] =
            req.body.reportDate.split("-").map(Number);

        const reportDate = new Date(
            Date.UTC(year, month - 1, day)
        );

        if (
            reportDate.getUTCFullYear() !== year ||
            reportDate.getUTCMonth() !== month - 1 ||
            reportDate.getUTCDate() !== day
        ) {
            return res.status(400).send(
                "The report date is invalid."
            );
        }

        // Workers cannot submit reports for future dates.
        const today = new Date();
        const todayUTC = Date.UTC(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );

        if (reportDate.getTime() > todayUTC) {
            return res.status(400).send(
                "Report date cannot be in the future."
            );
        }

        if (!workPerformed) {
            return res.status(400).send(
                "Please describe the work performed."
            );
        }

        if (workPerformed.length > 5000) {
            return res.status(400).send(
                "Work performed cannot exceed 5000 characters."
            );
        }

        if (
            !Number.isInteger(labourCount) ||
            labourCount < 0 ||
            labourCount > 10000
        ) {
            return res.status(400).send(
                "Labour count must be a whole number between 0 and 10000."
            );
        }

        if (
            materialsUsed.length > 3000 ||
            issues.length > 3000 ||
            remarks.length > 3000
        ) {
            return res.status(400).send(
                "Materials, issues and remarks cannot exceed 3000 characters each."
            );
        }

        
const uploadedPhotos = [];

try {
    for (const file of (req.files || [])) {
        const photo = await uploadImageBuffer(
            file.buffer,
            `buildtrack/daily-reports/${task.project}/${task._id}`
        );

        uploadedPhotos.push(photo);
    }

    const savedReport = await DailyWorkReport.create({
    task: task._id,
    project: task.project,
    worker: req.user._id,
    reportDate,
    workPerformed,
    labourCount,
    materialsUsed,
    issues,
    remarks,
    photos: uploadedPhotos,
    status: "PENDING"
});

// Notify the engineer assigned to this project's task.
try {
    const taskWithProject = await Task.findById(task._id)
        .populate("project", "name engineer");

    if (taskWithProject?.project?.engineer) {
        await Notification.create({
            recipient: taskWithProject.project.engineer,
            type: "PROJECT_UPDATE",
            title: "New daily progress report",
            message: `${req.user.name || "A worker"} submitted a daily progress report for ${taskWithProject.project.name}.`,
            project: taskWithProject.project._id,
            task: task._id
        });
    }
} catch (notificationError) {
    // A notification failure must not undo a successfully saved report.
    console.error(
        "Daily report notification error:",
        notificationError.message
    );
}

} catch (uploadError) {
    // Remove images already uploaded if the report cannot be saved.
    await Promise.allSettled(
        uploadedPhotos.map(photo => deleteImage(photo.publicId))
    );

    console.error(
        "Daily report photo upload error:",
        uploadError.message
    );

    return res.status(500).send(
        "The daily report could not be saved. Please retry."
    );
}

return res.redirect(
    `/worker/tasks/${task._id}/daily-report?submitted=1`
);


        return res.redirect(
            `/worker/tasks/${task._id}/daily-report?submitted=1`
        );

    } catch (error) {
        console.error(
            "Daily report submission error:",
            error.message
        );

        if (error.name === "CastError") {
            return res.status(404).send("Task not found.");
        }

        return res.status(500).send(
            "Failed to submit daily work report."
        );
    }
};

// ==========================================
// WORKER DAILY REPORT HISTORY
// ==========================================

const getWorkerReports = async (req, res) => {
    try {
        const reports = await DailyWorkReport.find({
            worker: req.user._id
        })
            .populate("project", "name")
            .populate("task", "name")
            .sort({
                reportDate: -1,
                createdAt: -1
            });

        return res.render("worker/reports", {
            reports
        });
    } catch (error) {
        console.error(
            "Get worker reports error:",
            error.message
        );

        return res.status(500).send(
            "Unable to load your daily reports."
        );
    }
};


// ==========================================
// WORKER PROGRESS HISTORY
// ==========================================

const getWorkerProgressUpdates = async (req, res) => {
    try {
        const updates = await WorkerProgressUpdate.find({
            worker: req.user._id
        })
            .populate("project", "name")
            .populate("task", "name")
            .sort({
                createdAt: -1
            });

        return res.render("worker/progress", {
            updates
        });
    } catch (error) {
        console.error(
            "Get worker progress updates error:",
            error.message
        );

        return res.status(500).send(
            "Unable to load your progress updates."
        );
    }
};



module.exports = {
    getWorkerDashboard,
    getWorkerTasks,
    getWorkerTaskDetails,
    getWorkerProgressForm,
    submitWorkerProgress,
    getDailyWorkReportForm,
    submitDailyWorkReport,
    getWorkerReports,
getWorkerProgressUpdates
};