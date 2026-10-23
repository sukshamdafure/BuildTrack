
const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const Project = require("../models/Project");

const EXPENSE_CATEGORIES = [
    "MATERIAL",
    "LABOUR",
    "EQUIPMENT",
    "TRANSPORTATION",
    "OTHER"
];

const getEngineerProjects = async (engineerId) => {
    return Project.find({
        engineer: engineerId
    })
        .select("_id name budget")
        .sort({ name: 1 });
};

// GET /engineer/expenses
// Show expenses recorded against the engineer's own projects.
const getExpenses = async (req, res) => {
    try {
        const projects = await getEngineerProjects(req.user._id);
        const projectIds = projects.map((project) => project._id);

        const expenses = await Expense.find({
            project: { $in: projectIds }
        })
            .populate("project", "name")
            .populate("recordedBy", "name")
            .sort({ date: -1, createdAt: -1 });

        const summary = {
            totalExpenses: expenses.length,
            totalAmount: expenses.reduce(
                (total, expense) => total + Number(expense.amount || 0),
                0
            ),
            material: 0,
            labour: 0,
            equipment: 0,
            transportation: 0,
            other: 0
        };

        expenses.forEach((expense) => {
            const amount = Number(expense.amount || 0);

            switch (expense.category) {
                case "MATERIAL":
                    summary.material += amount;
                    break;
                case "LABOUR":
                    summary.labour += amount;
                    break;
                case "EQUIPMENT":
                    summary.equipment += amount;
                    break;
                case "TRANSPORTATION":
                    summary.transportation += amount;
                    break;
                case "OTHER":
                    summary.other += amount;
                    break;
                default:
                    break;
            }
        });

        res.render("engineer/expenses", {
            expenses,
            projects,
            summary
        });
    } catch (error) {
        console.error("Get expenses error:", error.message);
        return res.status(500).send("Failed to load expenses.");
    }
};

// GET /engineer/expenses/new
// Show the form for recording an expense.
const showCreateExpenseForm = async (req, res) => {
    try {
        const projects = await getEngineerProjects(req.user._id);

        res.render("engineer/expense-form", {
            projects,
            formData: {
                project: req.query.projectId || "",
                date: new Date().toISOString().slice(0, 10)
            },
            error: null
        });
    } catch (error) {
        console.error("Show expense form error:", error.message);
        return res.status(500).send("Failed to load the expense form.");
    }
};

// POST /engineer/expenses
// Record an expense only against a project managed by this engineer.
const createExpense = async (req, res) => {
    try {
        const projects = await getEngineerProjects(req.user._id);

        const {
            project: projectId,
            category,
            amount,
            description,
            date
        } = req.body;

        let error = null;
        const expenseAmount = Number(amount);
        let expenseDate = new Date();

        if (!projectId || !mongoose.isValidObjectId(projectId)) {
            error = "Please select a valid project.";
        } else if (!EXPENSE_CATEGORIES.includes(category)) {
            error = "Please select a valid expense category.";
        } else if (
            amount === undefined ||
            amount === "" ||
            !Number.isFinite(expenseAmount) ||
            expenseAmount < 0
        ) {
            error = "Enter a valid expense amount greater than or equal to zero.";
        } else if (description && description.trim().length > 500) {
            error = "Description cannot exceed 500 characters.";
        } else if (date) {
            expenseDate = new Date(`${date}T12:00:00`);

            if (Number.isNaN(expenseDate.getTime())) {
                error = "Please enter a valid expense date.";
            }
        }

        if (!error) {
            const project = await Project.findOne({
                _id: projectId,
                engineer: req.user._id
            }).select("_id");

            if (!project) {
                error = "The selected project was not found or is not assigned to you.";
            }
        }

        if (error) {
            return res.status(400).render("engineer/expense-form", {
                projects,
                formData: req.body,
                error
            });
        }

        await Expense.create({
            project: projectId,
            category,
            amount: expenseAmount,
            description: description ? description.trim() : "",
            date: expenseDate,
            recordedBy: req.user._id
        });

        return res.redirect("/engineer/expenses");
    } catch (error) {
        console.error("Create expense error:", error.message);

        if (error.name === "ValidationError") {
            const projects = await getEngineerProjects(req.user._id);

            return res.status(400).render("engineer/expense-form", {
                projects,
                formData: req.body,
                error: error.message
            });
        }

        return res.status(500).send("Failed to record the expense.");
    }
};

module.exports = {
    getExpenses,
    showCreateExpenseForm,
    createExpense
};
