const User = require("../models/User");

// ==========================================
// GET REGISTER PAGE
// ==========================================

const getRegister = (req, res) => {
    res.render("auth/register");
};


// ==========================================
// GET LOGIN PAGE
// ==========================================

const getLogin = (req, res) => {
    res.render("auth/login");
};


// ==========================================
// REGISTER USER
// ==========================================

const register = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phone,
            role
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).send(
                "Name, email and password are required."
            );
        }

        const existingUser = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (existingUser) {
            return res.status(400).send(
                "An account with this email already exists."
            );
        }

        const allowedRoles = [
            "ENGINEER",
            "WORKER",
            "CLIENT"
        ];

        const selectedRole =
            allowedRoles.includes(role)
                ? role
                : "WORKER";

        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            phone,
            role: selectedRole
        });

        req.session.regenerate((error) => {
            if (error) {
                console.error(
                    "Session regeneration error:",
                    error.message
                );

                if (res.headersSent) {
                    return;
                }

                return res.status(500).send(
                    "Registration completed, but login session could not be created."
                );
            }

            req.session.userId = user._id.toString();
            req.session.userRole = user.role;

            req.session.save((saveError) => {
                if (saveError) {
                    console.error(
                        "Session save error:",
                        saveError.message
                    );

                    if (res.headersSent) {
                        return;
                    }

                    return res.status(500).send(
                        "Registration completed, but session could not be created."
                    );
                }

                return redirectByRole(
                    res,
                    user.role
                );
            });
        });

    } catch (error) {
        console.error(
            "Registration error:",
            error.message
        );

        if (res.headersSent) {
            return;
        }

        return res.status(500).send(
            "Registration failed."
        );
    }
};


// ==========================================
// LOGIN USER
// ==========================================

const login = async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).send(
                "Email and password are required."
            );
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim()
        }).select("+password");

        if (!user) {
            return res.status(401).send(
                "Invalid email or password."
            );
        }

        if (!user.isActive) {
            return res.status(403).send(
                "Your account has been deactivated."
            );
        }

        const isPasswordCorrect =
            await user.comparePassword(password);

        if (!isPasswordCorrect) {
            return res.status(401).send(
                "Invalid email or password."
            );
        }

        // Regenerate session after successful authentication
        req.session.regenerate((error) => {
            if (error) {
                console.error(
                    "Session regeneration error:",
                    error.message
                );

                // Do not send another response if one
                // has already been sent.
                if (res.headersSent) {
                    return;
                }

                return res.status(500).send(
                    "Login failed."
                );
            }

            req.session.userId = user._id.toString();
            req.session.userRole = user.role;

            req.session.save((saveError) => {
                if (saveError) {
                    console.error(
                        "Session save error:",
                        saveError.message
                    );

                    if (res.headersSent) {
                        return;
                    }

                    return res.status(500).send(
                        "Login failed."
                    );
                }
                console.log("Session saved successfully");
console.log("Session ID exists:", Boolean(req.sessionID));
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Response headers sent:", res.headersSent);

                console.log(
                    `User logged in: ${user.email} (${user.role})`
                );
res.on("finish", () => {
    console.log(
        "Login response Set-Cookie present:",
        Boolean(res.getHeader("Set-Cookie"))
    );
});
                return redirectByRole(
                    res,
                    user.role
                );
            });
        });

    } catch (error) {
        console.error(
            "Login error:",
            error.message
        );

        if (res.headersSent) {
            return;
        }

        return res.status(500).send(
            "Login failed."
        );
    }
};


// ==========================================
// LOGOUT USER
// ==========================================

const logout = (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error(
                "Logout error:",
                error.message
            );

            return res.status(500).send(
                "Logout failed."
            );
        }

        res.redirect("/login");
    });
};


// ==========================================
// ROLE-BASED REDIRECTION
// ==========================================

const redirectByRole = (res, role) => {

    switch (role) {

        case "ADMIN":
            return res.redirect("/admin/dashboard");

        case "ENGINEER":
            return res.redirect("/engineer/dashboard");

        case "WORKER":
            return res.redirect("/worker/dashboard");

        case "CLIENT":
            return res.redirect("/client/dashboard");

        default:
            return res.redirect("/");
    }
};


module.exports = {
    getRegister,
    getLogin,
    register,
    login,
    logout
};