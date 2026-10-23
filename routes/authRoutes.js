const express = require("express");

const {
    getRegister,
    getLogin,
    register,
    login,
    logout
} = require("../controllers/authController");

const router = express.Router();


// Registration page
router.get(
    "/register",
    getRegister
);


// Registration form
router.post(
    "/register",
    register
);


// Login page
router.get(
    "/login",
    getLogin
);


// Login form
router.post(
    "/login",
    login
);


// Logout
router.get(
    "/logout",
    logout
);


module.exports = router;