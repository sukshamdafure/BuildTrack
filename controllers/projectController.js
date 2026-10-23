const Project = require("../models/Project");
const User = require("../models/User");
const Expense = require("../models/Expense");


// ==========================================
// GET ALL PROJECTS
// ==========================================

const getProjects = async (req, res) => {
    try {

        const projects = await Project.find({
            engineer: req.user._id
        })
        .populate("client", "name email")
        .sort({ createdAt: -1 });

        res.render("engineer/projects", {
            projects
        });

    } catch (error) {

        console.error("Get projects error:", error.message);

        return res.status(500).send("Unable to load projects.");
    }
};


// ==========================================
// GET CREATE PROJECT FORM
// ==========================================

const getCreateProject = async (req, res) => {
    try {

        const clients = await User.find({
            role: "CLIENT",
            isActive: true
        })
        .select("name email")
        .sort({ name: 1 });

        res.render("engineer/project-form", {
            clients
        });

    } catch (error) {

        console.error("Get create project form error:", error.message);

        return res.status(500).send("Unable to load project form.");
    }
};


// ==========================================
// CREATE PROJECT
// ==========================================

const createProject = async (req, res) => {
    try {

        const {
            name,
            client,
            siteLocation,
            description,
            projectType,
            startDate,
            expectedCompletionDate,
            budget,
            status
        } = req.body;


        // Basic validation

        if (
            !name ||
            !client ||
            !siteLocation ||
            !startDate ||
            !expectedCompletionDate ||
            budget === undefined ||
            budget === ""
        ) {
            return res.status(400).send(
                "Please fill all required project fields."
            );
        }


        // Verify client

        const clientUser = await User.findOne({
            _id: client,
            role: "CLIENT",
            isActive: true
        });

        if (!clientUser) {
            return res.status(400).send("Invalid client selected.");
        }


        // Validate dates

        const start = new Date(startDate);
        const completion = new Date(expectedCompletionDate);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(completion.getTime())
        ) {
            return res.status(400).send("Invalid project dates.");
        }

        if (completion < start) {
            return res.status(400).send(
                "Expected completion date cannot be before the start date."
            );
        }


        // Create project

        const project = await Project.create({

            name: name.trim(),

            client: clientUser._id,

            engineer: req.user._id,

            siteLocation: siteLocation.trim(),

            description: description ? description.trim() : "",

            projectType: projectType ? projectType.trim() : "",

            startDate: start,

            expectedCompletionDate: completion,

            budget: Number(budget),

            status: status || "PLANNING",

            progress: 0

        });


        console.log(`Project created: ${project.name}`);

        return res.redirect("/engineer/projects");

    } catch (error) {

        console.error("Create project error:", error.message);

        return res.status(500).send("Unable to create project.");
    }
};

// ==========================================
// GET PROJECT DETAILS
// ==========================================

const getProjectDetails = async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.id,
            engineer: req.user._id
        })
            .populate("client", "name email phone")
            .populate("engineer", "name email");

        if (!project) {
            return res.status(404).send("Project not found.");
        }

        // Calculate expenses recorded against this project.
const expenseTotals = await Expense.aggregate([
    {
        $match: {
            project: project._id
        }
    },
    {
        $group: {
            _id: null,
            totalAmount: { $sum: "$amount" }
        }
    }
]);

const actualSpending = Number(
    expenseTotals[0]?.totalAmount || 0
);

const allocatedBudget = Number(project.budget || 0);

const remainingBudget = allocatedBudget - actualSpending;

const budgetUtilization = allocatedBudget > 0
    ? Number(
        ((actualSpending / allocatedBudget) * 100).toFixed(2)
    )
    : 0;

        res.render("engineer/project-details", {
           project,
    financialSummary: {
        allocatedBudget,
        actualSpending,
        remainingBudget,
        budgetUtilization
    }
        });

    } catch (error) {
        console.error("Get project details error:", error.message);
        return res.status(500).send("Unable to load project details.");
    }
};


// ==========================================
// GET EDIT PROJECT FORM
// ==========================================

const getEditProject = async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.id,
            engineer: req.user._id
        });

        if (!project) {
            return res.status(404).send("Project not found.");
        }

        const clients = await User.find({
            role: "CLIENT",
            isActive: true
        })
            .select("name email")
            .sort({ name: 1 });

        res.render("engineer/project-edit", {
            project,
            clients
        });

    } catch (error) {
        console.error("Get edit project error:", error.message);
        return res.status(500).send("Unable to load edit form.");
    }
};

// ==========================================
// UPDATE PROJECT
// ==========================================

const updateProject = async (req, res) => {
    try {
        const {
            name,
            client,
            siteLocation,
            description,
            projectType,
            startDate,
            expectedCompletionDate,
            budget,
            status
        } = req.body;

        if (Number(budget) < 0) {
            return res.status(400).send(
                "Project budget cannot be negative."
            );
}

        if (
            !name ||
            !client ||
            !siteLocation ||
            !startDate ||
            !expectedCompletionDate ||
            budget === undefined ||
            budget === ""
        ) {
            return res.status(400).send(
                "Please fill all required project fields."
            );
        }

        const project = await Project.findOne({
            _id: req.params.id,
            engineer: req.user._id
        });

        if (!project) {
            return res.status(404).send("Project not found.");
        }

        const clientUser = await User.findOne({
            _id: client,
            role: "CLIENT",
            isActive: true
        });

        if (!clientUser) {
            return res.status(400).send("Invalid client selected.");
        }

        const start = new Date(startDate);
        const completion = new Date(expectedCompletionDate);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(completion.getTime())
        ) {
            return res.status(400).send("Invalid project dates.");
        }

        if (completion < start) {
            return res.status(400).send(
                "Expected completion date cannot be before the start date."
            );
        }

        project.name = name.trim();
        project.client = clientUser._id;
        project.siteLocation = siteLocation.trim();
        project.description = description ? description.trim() : "";
        project.projectType = projectType ? projectType.trim() : "";
        project.startDate = start;
        project.expectedCompletionDate = completion;
        project.budget = Number(budget);
        project.status = status || project.status;

        await project.save();

        console.log(`Project updated: ${project.name}`);

        return res.redirect(
            `/engineer/projects/${project._id}`
        );

    } catch (error) {
        console.error("Update project error:", error.message);
        return res.status(500).send("Unable to update project.");
    }
};

module.exports = {
    getProjects,
    getCreateProject,
    createProject,
    getProjectDetails,
    getEditProject,
    updateProject
};