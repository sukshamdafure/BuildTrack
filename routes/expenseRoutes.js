
const express = require("express");

const {
    getExpenses,
    showCreateExpenseForm,
    createExpense
} = require("../controllers/expenseController");

const { requireAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

// View expenses across the engineer's projects.
router.get(
    "/engineer/expenses",
    requireAuth,
    requireRole("ENGINEER"),
    getExpenses
);

// Display the expense creation form.
router.get(
    "/engineer/expenses/new",
    requireAuth,
    requireRole("ENGINEER"),
    showCreateExpenseForm
);

// Save an expense.
router.post(
    "/engineer/expenses",
    requireAuth,
    requireRole("ENGINEER"),
    createExpense
);

module.exports = router;
