const User = require("../models/User");

const requireAuth = async (req, res, next) => {
    try {
        // Check whether a session exists
        if (!req.session || !req.session.userId) {
            return res.redirect("/login");
        }

        // Find currently logged-in user
        const user = await User.findById(
            req.session.userId
        );

        if (!user) {
            req.session.destroy(() => {});
            return res.redirect("/login");
        }

        // Check whether account is active
        if (!user.isActive) {
            req.session.destroy(() => {});

            return res.status(403).send(
                "Your account has been deactivated."
            );
        }

        // Make user available to controllers/views
        req.user = user;

        next();

    } catch (error) {
        console.error(
            "Authentication middleware error:",
            error.message
        );

        return res.status(500).send(
            "Authentication error."
        );
    }
};

module.exports = {
    requireAuth
};