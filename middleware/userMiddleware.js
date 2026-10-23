const User = require("../models/User");

const loadCurrentUser = async (req, res, next) => {
    try {
        res.locals.currentUser = null;

        if (!req.session || !req.session.userId) {
            return next();
        }

        const user = await User.findById(
            req.session.userId
        );

        if (!user || !user.isActive) {
            return next();
        }

        req.user = user;

        res.locals.currentUser = user;

        next();

    } catch (error) {
        console.error(
            "Load current user error:",
            error.message
        );

        next();
    }
};

module.exports = {
    loadCurrentUser
};