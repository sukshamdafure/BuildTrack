const Task = require("../models/Task");
const Project = require("../models/Project");
const Notification = require("../models/Notification");
const {
    validateTaskState
} = require("../utils/taskRules");

const {
    getTaskDeadlineStatus,
    getDaysUntilDeadline,
    updateOverdueTasks
} = require("../services/deadlineService");

const {
    updateProjectProgress
} = require("../services/progressService");

const notifyWorkersOfTaskAssignment = async (
    task,
    workerIds,
    eventKey
) => {
    for (const worker of workerIds || []) {
        const recipientId = worker?._id || worker;

        if (!recipientId) {
            continue;
        }

        const dedupeKey = [
            "TASK_ASSIGNED",
            task._id.toString(),
            recipientId.toString(),
            eventKey
        ].join(":");

        try {
            await Notification.updateOne(
                { dedupeKey },
                {
                    $setOnInsert: {
                        recipient: recipientId,
                        type: "TASK_ASSIGNED",
                        title: "New task assigned",
                        message: `You have been assigned to the task "${task.name}".`,
                        project: task.project?._id || task.project,
                        task: task._id,
                        dedupeKey,
                        isRead: false
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error(
                "Task assignment notification error:",
                error.message
            );
        }
    }
};

const notifyTaskCompletion = async (task, project) => {
    const recipients = new Map();

    // Notify the project's client.
    if (project?.client) {
        recipients.set(
            project.client.toString(),
            project.client
        );
    }

    // Notify workers assigned to this task.
    for (const worker of task.assignedWorkers || []) {
        const recipientId = worker?._id || worker;

        if (recipientId) {
            recipients.set(
                recipientId.toString(),
                recipientId
            );
        }
    }

    const completionEvent = String(
        task.updatedAt?.getTime() || Date.now()
    );

    for (const recipientId of recipients.values()) {
        const dedupeKey = [
            "TASK_COMPLETED",
            task._id.toString(),
            completionEvent,
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
                        message: `The task "${task.name}" has been marked as completed.`,
                        project: project._id,
                        task: task._id,
                        dedupeKey,
                        isRead: false
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error(
                "Task completion notification error:",
                error.message
            );
        }
    }
};

const getTasks = async (req, res) => {
    try {
        const projects = await Project.find({
            engineer: req.user._id
        }).select("_id name");

        const projectIds = projects.map(project => project._id);

        const tasks = await Task.find({
            project: { $in: projectIds }
        })
            .populate("project", "name")
            .populate("assignedWorkers", "name email")
            .sort({ deadline: 1, startDate: 1 });


        await updateOverdueTasks(tasks);

        res.render("engineer/tasks", {
            tasks,
            project: null
        });

    } catch (error) {
        console.error("Get tasks error:", error.message);
        return res.status(500).send("Failed to load tasks.");
    }
};


const getProjectTasks = async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.projectId,
            engineer: req.user._id
        });

        if (!project) {
            return res.status(404).send("Project not found.");
        }

        const tasks = await Task.find({
            project: project._id
        })
            .populate("assignedWorkers", "name email")
            .sort({ deadline: 1, startDate: 1 });

        await updateOverdueTasks(tasks);

        res.render("engineer/tasks", {
            tasks,
            project
        });

    } catch (error) {
        console.error("Get project tasks error:", error.message);
        return res.status(500).send("Failed to load project tasks.");
    }
};

const getCreateTask = async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.projectId,
            engineer: req.user._id
        });

        if (!project) {
            return res.status(404).send("Project not found.");
        }

        const User = require("../models/User");

        const workers = await User.find({
            role: "WORKER",
            isActive: true
        })
            .select("name email")
            .sort({ name: 1 });

        const dependencies = await Task.find({
            project: project._id
        })
            .select("name status")
            .sort({ name: 1 });

        res.render("engineer/task-form", {
            project,
            workers,
            dependencies
        });

    } catch (error) {
        console.error("Get create task error:", error.message);
        return res.status(500).send("Failed to load task form.");
    }
};
const createTask = async (req, res) => {
    try {
        const {
            name,
            description,
            assignedWorkers,
            startDate,
            deadline,
            priority,
            status,
            progress,
            weight,
            estimatedDuration,
            dependencies,
            remarks
        } = req.body;

        /* =========================
           BASIC VALIDATION
        ========================= */

        if (
            !name ||
            !startDate ||
            !deadline ||
            !priority ||
            !status ||
            progress === undefined ||
            progress === "" ||
            weight === undefined ||
            weight === ""
        ) {
            return res.status(400).send(
                "Please fill all required task fields."
            );
        }


        /* =========================
           PROJECT OWNERSHIP
        ========================= */

        const project = await Project.findOne({
            _id: req.params.projectId,
            engineer: req.user._id
        });

        if (!project) {
            return res.status(404).send("Project not found.");
        }


        /* =========================
           DATE VALIDATION
        ========================= */

        const taskStartDate = new Date(startDate);
        const taskDeadline = new Date(deadline);

        if (
            Number.isNaN(taskStartDate.getTime()) ||
            Number.isNaN(taskDeadline.getTime())
        ) {
            return res.status(400).send("Invalid task dates.");
        }

        if (taskDeadline < taskStartDate) {
            return res.status(400).send(
                "Task deadline cannot be before the start date."
            );
        }


        /* =========================
           PROJECT DATE VALIDATION
        ========================= */

        if (taskStartDate < project.startDate) {
            return res.status(400).send(
                "Task cannot start before the project start date."
            );
        }

        if (taskDeadline > project.expectedCompletionDate) {
            return res.status(400).send(
                "Task deadline cannot exceed the project completion date."
            );
        }


        /* =========================
           NUMERIC VALIDATION
        ========================= */

        const taskProgress = Number(progress);
        const taskWeight = Number(weight);

        const taskState = validateTaskState(
            taskProgress,
            status
        );

        if (!taskState.valid) {
            return res.status(400).send(taskState.message);
        }

        if (
            Number.isNaN(taskWeight) ||
            taskWeight <= 0 ||
            taskWeight > 100
        ) {
            return res.status(400).send(
                "Task weight must be greater than 0 and at most 100."
            );
        }


        /* =========================
           WORKER VALIDATION
        ========================= */

        const User = require("../models/User");

        let workerIds = [];

        if (assignedWorkers) {
            workerIds = Array.isArray(assignedWorkers)
                ? assignedWorkers
                : [assignedWorkers];
        }

        if (workerIds.length > 0) {

            const workers = await User.find({
                _id: { $in: workerIds },
                role: "WORKER",
                isActive: true
            }).select("_id");

            if (workers.length !== workerIds.length) {
                return res.status(400).send(
                    "One or more selected workers are invalid."
                );
            }
        }


        /* =========================
           DEPENDENCY VALIDATION
        ========================= */

        let dependencyIds = [];

        if (dependencies) {
            dependencyIds = Array.isArray(dependencies)
                ? dependencies
                : [dependencies];
        }

        if (dependencyIds.length > 0) {

            const dependencyTasks = await Task.find({
                _id: { $in: dependencyIds },
                project: project._id
            }).select("_id");

            if (dependencyTasks.length !== dependencyIds.length) {
                return res.status(400).send(
                    "One or more selected dependencies are invalid."
                );
            }
        }

        let actualCompletionDate;

        if (taskProgress === 100 && status === "COMPLETED") {
            actualCompletionDate = new Date();
        }


        /* =========================
           CREATE TASK
        ========================= */

        const task = await Task.create({
            project: project._id,
            name: name.trim(),
            description: description ? description.trim() : "",
            assignedWorkers: workerIds,
            startDate: taskStartDate,
            deadline: taskDeadline,
            priority,
            status,
            progress: taskProgress,
            weight: taskWeight,
            estimatedDuration:
                estimatedDuration !== undefined &&
                estimatedDuration !== ""
                    ? Number(estimatedDuration)
                    : undefined,
            dependencies: dependencyIds,
            remarks: remarks ? remarks.trim() : "",
            actualCompletionDate
        });

        await notifyWorkersOfTaskAssignment(
    task,
    workerIds,
    task.createdAt.getTime().toString()
);

        await updateProjectProgress(project._id);

        console.log(
            `Task created: ${task.name} (${task._id})`
        );

        return res.redirect(
            `/engineer/projects/${project._id}/tasks`
        );

    } catch (error) {

        console.error("Create task error:", error.message);

        return res.status(500).send(
            "Failed to create task."
        );
    }
};

const getTaskDetails = async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.taskId
        })
            .populate("project", "name engineer startDate expectedCompletionDate")
            .populate("assignedWorkers", "name email phone")
            .populate("dependencies", "name status progress deadline");

        if (!task) {
            return res.status(404).send("Task not found.");
        }

        // Make sure this task belongs to a project
        // managed by the logged-in engineer.
        if (
            !task.project ||
            task.project.engineer.toString() !== req.user._id.toString()
        ) {
            return res.status(403).send(
                "You do not have permission to access this task."
            );
        }

        const deadlineStatus = getTaskDeadlineStatus(task);
        const daysUntilDeadline = getDaysUntilDeadline(task);

        res.render("engineer/task-details", {
            task,
            deadlineStatus,
            daysUntilDeadline
        });

    } catch (error) {
        console.error("Get task details error:", error.message);
        return res.status(500).send("Failed to load task details.");
    }
};

const getEditTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId)
            .populate(
                "project",
                "name engineer startDate expectedCompletionDate"
            )
            .populate("assignedWorkers", "name email")
            .populate("dependencies", "name status");

        if (!task) {
            return res.status(404).send("Task not found.");
        }

        if (
            !task.project ||
            task.project.engineer.toString() !== req.user._id.toString()
        ) {
            return res.status(403).send(
                "You do not have permission to edit this task."
            );
        }

        const User = require("../models/User");

        const workers = await User.find({
            role: "WORKER",
            isActive: true
        })
            .select("name email")
            .sort({ name: 1 });

        /*
         * Exclude the current task from dependencies.
         * A task cannot depend on itself.
         */
        const dependencies = await Task.find({
            project: task.project._id,
            _id: { $ne: task._id }
        })
            .select("name status")
            .sort({ name: 1 });

        res.render("engineer/task-edit", {
            task,
            workers,
            dependencies
        });

    } catch (error) {
        console.error("Get edit task error:", error.message);
        return res.status(500).send("Failed to load edit task page.");
    }
};

const updateTask = async (req, res) => {
    try {
        const {
            name,
            description,
            assignedWorkers,
            startDate,
            deadline,
            priority,
            status,
            progress,
            weight,
            estimatedDuration,
            dependencies,
            remarks
        } = req.body;


        /* =========================
           BASIC VALIDATION
        ========================= */

        if (
            !name ||
            !startDate ||
            !deadline ||
            !priority ||
            !status ||
            progress === undefined ||
            progress === "" ||
            weight === undefined ||
            weight === ""
        ) {
            return res.status(400).send(
                "Please fill all required task fields."
            );
        }


        /* =========================
           FIND TASK + PROJECT
        ========================= */

        const task = await Task.findById(req.params.taskId)
    .populate(
        "project",
        "engineer client startDate expectedCompletionDate"
    );

        if (!task) {
            return res.status(404).send("Task not found.");
        }


        /* =========================
           PROJECT OWNERSHIP
        ========================= */

        if (
            !task.project ||
            task.project.engineer.toString() !== req.user._id.toString()
        ) {
            return res.status(403).send(
                "You do not have permission to edit this task."
            );
        }


        const project = task.project;

        const wasCompleted =
    task.status === "COMPLETED" ||
    Number(task.progress) === 100;


        /* =========================
           DATE VALIDATION
        ========================= */

        const taskStartDate = new Date(startDate);
        const taskDeadline = new Date(deadline);

        if (
            Number.isNaN(taskStartDate.getTime()) ||
            Number.isNaN(taskDeadline.getTime())
        ) {
            return res.status(400).send("Invalid task dates.");
        }

        if (taskDeadline < taskStartDate) {
            return res.status(400).send(
                "Task deadline cannot be before the start date."
            );
        }

        if (taskStartDate < project.startDate) {
            return res.status(400).send(
                "Task cannot start before the project start date."
            );
        }

        if (taskDeadline > project.expectedCompletionDate) {
            return res.status(400).send(
                "Task deadline cannot exceed the project completion date."
            );
        }


        /* =========================
           NUMERIC VALIDATION
        ========================= */

        const taskProgress = Number(progress);
        const taskWeight = Number(weight);

        const taskState = validateTaskState(
            taskProgress,
            status
        );

        if (!taskState.valid) {
            return res.status(400).send(taskState.message);
        }

        if (
            Number.isNaN(taskWeight) ||
            taskWeight <= 0 ||
            taskWeight > 100
        ) {
            return res.status(400).send(
                "Task weight must be greater than 0 and at most 100."
            );
        }


        /* =========================
           WORKER VALIDATION
        ========================= */

        const User = require("../models/User");

        let workerIds = [];

        if (assignedWorkers) {
            workerIds = Array.isArray(assignedWorkers)
                ? assignedWorkers
                : [assignedWorkers];
        }

        if (workerIds.length > 0) {

            const workers = await User.find({
                _id: { $in: workerIds },
                role: "WORKER",
                isActive: true
            }).select("_id");

            if (workers.length !== workerIds.length) {
                return res.status(400).send(
                    "One or more selected workers are invalid."
                );
            }
        }


        /* =========================
           DEPENDENCY VALIDATION
        ========================= */

        let dependencyIds = [];

        if (dependencies) {
            dependencyIds = Array.isArray(dependencies)
                ? dependencies
                : [dependencies];
        }


        // Prevent task from depending on itself.

        if (
            dependencyIds.some(
                id => id.toString() === task._id.toString()
            )
        ) {
            return res.status(400).send(
                "A task cannot depend on itself."
            );
        }


        if (dependencyIds.length > 0) {

            const dependencyTasks = await Task.find({
                _id: { $in: dependencyIds },
                project: project._id
            }).select("_id");

            if (dependencyTasks.length !== dependencyIds.length) {
                return res.status(400).send(
                    "One or more selected dependencies are invalid."
                );
            }
        }


        /* =========================
           UPDATE TASK
        ========================= */

        task.name = name.trim();

        task.description = description
            ? description.trim()
            : "";
        const previouslyAssignedWorkerIds = new Set(
    (task.assignedWorkers || []).map(
        workerId => workerId.toString()
    )
);

        task.assignedWorkers = workerIds;

        task.startDate = taskStartDate;

        task.deadline = taskDeadline;

        task.priority = priority;

        task.status = status;

        task.progress = taskProgress;

        task.weight = taskWeight;

        task.estimatedDuration =
            estimatedDuration !== undefined &&
            estimatedDuration !== ""
                ? Number(estimatedDuration)
                : undefined;

        task.dependencies = dependencyIds;

        task.remarks = remarks
            ? remarks.trim()
            : "";


        /*
         * Automatically record completion date
         * when task reaches 100%.
         */

        if (
            task.progress === 100 ||
            task.status === "COMPLETED"
        ) {
            if (!task.actualCompletionDate) {
                task.actualCompletionDate = new Date();
            }
        } else {
            task.actualCompletionDate = undefined;
        }


        await task.save();
        const isNowCompleted =
    task.status === "COMPLETED" ||
    Number(task.progress) === 100;

if (!wasCompleted && isNowCompleted) {
    await notifyTaskCompletion(task, project);
}

        const newlyAssignedWorkerIds = workerIds.filter(
    workerId =>
        !previouslyAssignedWorkerIds.has(workerId.toString())
);

await notifyWorkersOfTaskAssignment(
    task,
    newlyAssignedWorkerIds,
    `updated-${task.updatedAt.getTime()}`
);

        await updateProjectProgress(project._id);

        console.log(
            `Task updated: ${task.name} (${task._id})`
        );

        return res.redirect(
            `/engineer/tasks/${task._id}`
        );

    } catch (error) {

        console.error("Update task error:", error.message);

        return res.status(500).send(
            "Failed to update task."
        );
    }
};
// ==========================================
// ENGINEER WORKER DIRECTORY
// ==========================================

const getEngineerWorkers = async (req, res) => {
    try {
        const User = require("../models/User");

        const projects = await Project.find({
            engineer: req.user._id
        }).select("_id");

        const projectIds = projects.map(project => project._id);

        const workers = await User.find({
            role: "WORKER",
            isActive: true
        })
            .select("name email phone")
            .sort({ name: 1 })
            .lean();

        const tasks = projectIds.length > 0
            ? await Task.find({
                project: { $in: projectIds }
            })
                .select("name status progress assignedWorkers")
                .lean()
            : [];

        const workersWithStats = workers.map(worker => {
            const workerTasks = tasks.filter(task =>
                (task.assignedWorkers || []).some(
                    workerId =>
                        workerId.toString() === worker._id.toString()
                )
            );

            const completedTasks = workerTasks.filter(
                task =>
                    task.status === "COMPLETED" ||
                    Number(task.progress) === 100
            );

            return {
                ...worker,
                totalTaskCount: workerTasks.length,
                activeTaskCount:
                    workerTasks.length - completedTasks.length,
                completedTaskCount: completedTasks.length
            };
        });

        return res.render("engineer/workers", {
            workers: workersWithStats
        });
    } catch (error) {
        console.error(
            "Get engineer workers error:",
            error.message
        );

        return res.status(500).send(
            "Unable to load workers."
        );
    }
};

module.exports = {
    getTasks,
    getProjectTasks,
    getCreateTask,
    createTask,
    getTaskDetails,
    getEditTask,
    updateTask,
    getEngineerWorkers
};