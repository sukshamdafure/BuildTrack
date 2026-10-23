
const express = require("express");

const {
    getMaterials,
    getProjectMaterials,
    showCreateMaterialForm,
    createMaterial,
    recordMaterialUsage
} = require("../controllers/materialController");

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

// All materials across the engineer's projects.
router.get(
    "/engineer/materials",
    requireAuth,
    requireRole("ENGINEER"),
    getMaterials
);

// Materials for one project.
router.get(
    "/engineer/projects/:projectId/materials",
    requireAuth,
    requireRole("ENGINEER"),
    getProjectMaterials
);

// Display the new-material form.
router.get(
    "/engineer/projects/:projectId/materials/new",
    requireAuth,
    requireRole("ENGINEER"),
    showCreateMaterialForm
);

// Save a new material.
router.post(
    "/engineer/projects/:projectId/materials",
    requireAuth,
    requireRole("ENGINEER"),
    createMaterial
);

// Record material usage.
router.post(
    "/engineer/materials/:materialId/usage",
    requireAuth,
    requireRole("ENGINEER"),
    recordMaterialUsage
);

module.exports = router;
