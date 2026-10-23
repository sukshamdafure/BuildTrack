const express = require("express");

const {
    getProjects,
    getCreateProject,
    createProject,
    getProjectDetails,
    getEditProject,
    updateProject
} = require("../controllers/projectController");

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();


// Engineer project management

router.get(
    "/engineer/projects",
    requireAuth,
    requireRole("ENGINEER"),
    getProjects
);


router.get(
    "/engineer/projects/new",
    requireAuth,
    requireRole("ENGINEER"),
    getCreateProject
);


router.post(
    "/engineer/projects",
    requireAuth,
    requireRole("ENGINEER"),
    createProject
);

// Project details

router.get(
    "/engineer/projects/:id",
    requireAuth,
    requireRole("ENGINEER"),
    getProjectDetails
);


// Edit project

router.get(
    "/engineer/projects/:id/edit",
    requireAuth,
    requireRole("ENGINEER"),
    getEditProject
);


// Update project

router.post(
    "/engineer/projects/:id",
    requireAuth,
    requireRole("ENGINEER"),
    updateProject
);


module.exports = router;