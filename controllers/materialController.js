
const mongoose = require("mongoose");
const Material = require("../models/Material");
const Project = require("../models/Project");
const Expense = require("../models/Expense");

// Only projects owned by the logged-in engineer are accessible.
const findEngineerProject = async (projectId, engineerId) => {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return null;
    }

    return Project.findOne({
        _id: projectId,
        engineer: engineerId
    });
};

// Calculate the inventory summary without adding quantities
// from different units together.
const buildMaterialSummary = (materials) => {
    return {
        totalMaterials: materials.length,
        lowStock: materials.filter(
            (material) =>
                Number(material.remainingQuantity) <=
                Number(material.minimumStockLevel)
        ).length,
        outOfStock: materials.filter(
            (material) => Number(material.remainingQuantity) <= 0
        ).length
    };
};

// GET /engineer/materials
// Show materials belonging to all projects managed by the engineer.
const getMaterials = async (req, res) => {
    try {
        const projects = await Project.find({
            engineer: req.user._id
        }).select("_id name");

        const projectIds = projects.map((project) => project._id);

        const materials = await Material.find({
            project: { $in: projectIds }
        })
            .populate("project", "name")
            .sort({ name: 1 });

        res.render("engineer/materials", {
              materials,
    project: null,
    projects,
    summary: buildMaterialSummary(materials)
        });
    } catch (error) {
        console.error("Get materials error:", error.message);
        return res.status(500).send("Failed to load materials.");
    }
};

// GET /engineer/projects/:projectId/materials
// Show inventory for one project.
const getProjectMaterials = async (req, res) => {
    try {
        const project = await findEngineerProject(
            req.params.projectId,
            req.user._id
        );

        if (!project) {
            return res.status(404).send("Project not found.");
        }

        const materials = await Material.find({
            project: project._id
        })
            .populate("project", "name")
            .sort({ name: 1 });

        res.render("engineer/materials", {
             materials,
    project,
    projects: [project],
    summary: buildMaterialSummary(materials)
        });
    } catch (error) {
        console.error("Get project materials error:", error.message);
        return res.status(500).send("Failed to load project materials.");
    }
};

// GET /engineer/projects/:projectId/materials/new
// Show the create-material form.
const showCreateMaterialForm = async (req, res) => {
    try {
        const project = await findEngineerProject(
            req.params.projectId,
            req.user._id
        );

        if (!project) {
            return res.status(404).send("Project not found.");
        }

        res.render("engineer/material-form", {
            project,
            formData: {},
            error: null
        });
    } catch (error) {
        console.error("Show material form error:", error.message);
        return res.status(500).send("Failed to load material form.");
    }
};

// POST /engineer/projects/:projectId/materials
// Create a material inventory record.
const createMaterial = async (req, res) => {
    try {
        const project = await findEngineerProject(
            req.params.projectId,
            req.user._id
        );

        if (!project) {
            return res.status(404).send("Project not found.");
        }

        const {
            name,
            unit,
            initialQuantity,
            minimumStockLevel,
            supplier,
            cost
        } = req.body;

        const initialQty = Number(initialQuantity);
        const minimumQty = Number(minimumStockLevel);
        const materialCost = Number(cost);

        let error = null;

        if (!name || !name.trim()) {
            error = "Material name is required.";
        } else if (name.trim().length > 100) {
            error = "Material name cannot exceed 100 characters.";
        } else if (!unit || !unit.trim()) {
            error = "Material unit is required.";
        } else if (
            initialQuantity === undefined ||
            initialQuantity === "" ||
            !Number.isFinite(initialQty) ||
            initialQty < 0
        ) {
            error = "Enter a valid initial quantity greater than or equal to zero.";
        } else if (
            minimumStockLevel === undefined ||
            minimumStockLevel === "" ||
            !Number.isFinite(minimumQty) ||
            minimumQty < 0
        ) {
            error = "Enter a valid minimum stock level greater than or equal to zero.";
        } else if (
            cost === undefined ||
            cost === "" ||
            !Number.isFinite(materialCost) ||
            materialCost < 0
        ) {
            error = "Enter a valid material cost greater than or equal to zero.";
        } else if (supplier && supplier.trim().length > 150) {
            error = "Supplier name cannot exceed 150 characters.";
        }

        if (error) {
            return res.status(400).render("engineer/material-form", {
                project,
                formData: req.body,
                error
            });
        }

        
const material = await Material.create({
    project: project._id,
    name: name.trim(),
    unit: unit.trim(),
    initialQuantity: initialQty,
    usedQuantity: 0,
    minimumStockLevel: minimumQty,
    supplier: supplier ? supplier.trim() : "",
    cost: materialCost
});

// Material.cost represents cost per unit.
const purchaseExpenseAmount = Number(
    (initialQty * materialCost).toFixed(2)
);

try {
    // Create one purchase expense linked to this material.
    await Expense.create({
        project: project._id,
        material: material._id,
        category: "MATERIAL",
        amount: purchaseExpenseAmount,
        description:
            `Material purchase: ${material.name}; ` +
            `${initialQty} ${material.unit} at ` +
            `${materialCost.toFixed(2)} per ${material.unit}` +
            (supplier ? `; Supplier: ${supplier.trim()}` : ""),
        date: new Date(),
        recordedBy: req.user._id
    });
} catch (expenseError) {
    console.error(
        "Create material purchase expense error:",
        expenseError.message
    );

    // Best-effort cleanup so a failed expense does not leave
    // an apparently successful inventory purchase.
    try {
        await Expense.deleteOne({ material: material._id });
        await Material.findByIdAndDelete(material._id);
    } catch (cleanupError) {
        console.error(
            "Material purchase cleanup error:",
            cleanupError.message
        );
    }

    return res.status(500).send(
        "The material purchase expense could not be recorded. " +
        "Please check the database and try again."
    );
}

return res.redirect(
    `/engineer/projects/${project._id}/materials`
);

    } catch (error) {
        console.error("Create material error:", error.message);

        if (error.name === "ValidationError") {
            return res.status(400).send(error.message);
        }

        return res.status(500).send("Failed to create material.");
    }
};

// POST /engineer/materials/:materialId/usage
// Increase the recorded quantity used for a material.
const recordMaterialUsage = async (req, res) => {
    try {
        const { materialId } = req.params;
        const { quantity } = req.body;

        if (!mongoose.Types.ObjectId.isValid(materialId)) {
            return res.status(400).send("Invalid material ID.");
        }

        if (
            quantity === undefined ||
            quantity === "" ||
            !Number.isFinite(Number(quantity)) ||
            Number(quantity) <= 0
        ) {
            return res.status(400).send(
                "Usage quantity must be a valid number greater than zero."
            );
        }

        const material = await Material.findById(materialId);

        if (!material) {
            return res.status(404).send("Material not found.");
        }

        const project = await findEngineerProject(
            material.project,
            req.user._id
        );

        if (!project) {
            return res.status(403).send(
                "You do not have permission to update this material."
            );
        }

        const usageQuantity = Number(quantity);
        const remaining =
            Number(material.initialQuantity) -
            Number(material.usedQuantity);

        if (usageQuantity > remaining) {
            return res.status(400).send(
                `Insufficient stock. Only ${remaining} ${material.unit} remain.`
            );
        }

        material.usedQuantity =
            Number(material.usedQuantity) + usageQuantity;

        // Material.js recalculates remainingQuantity before saving.
        await material.save();

        return res.redirect(
            `/engineer/projects/${project._id}/materials`
        );
    } catch (error) {
        console.error("Record material usage error:", error.message);

        if (error.name === "ValidationError") {
            return res.status(400).send(error.message);
        }

        return res.status(500).send("Failed to record material usage.");
    }
};

module.exports = {
    getMaterials,
    getProjectMaterials,
    showCreateMaterialForm,
    createMaterial,
    recordMaterialUsage
};
