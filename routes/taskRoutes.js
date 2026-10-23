const express = require("express");

const {
    getTasks,
    getProjectTasks,
    getCreateTask,
    createTask,
    getTaskDetails,
    getEditTask,
    updateTask,
    getEngineerWorkers
} = require("../controllers/taskController");

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/engineer/tasks",
    requireAuth,
    requireRole("ENGINEER"),
    getTasks
);

router.get(
    "/engineer/projects/:projectId/tasks/new",
    requireAuth,
    requireRole("ENGINEER"),
    getCreateTask
);

router.post(
    "/engineer/projects/:projectId/tasks",
    requireAuth,
    requireRole("ENGINEER"),
    createTask
);

router.get(
    "/engineer/projects/:projectId/tasks",
    requireAuth,
    requireRole("ENGINEER"),
    getProjectTasks
);

router.get(
    "/engineer/tasks/:taskId",
    requireAuth,
    requireRole("ENGINEER"),
    getTaskDetails
);

router.get(
    "/engineer/tasks/:taskId/edit",
    requireAuth,
    requireRole("ENGINEER"),
    getEditTask
);

router.post(
    "/engineer/tasks/:taskId",
    requireAuth,
    requireRole("ENGINEER"),
    updateTask
);

router.get(
    "/engineer/workers",
    requireAuth,
    requireRole("ENGINEER"),
    getEngineerWorkers
);


module.exports = router;