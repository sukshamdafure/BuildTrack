const requireRole = (...allowedRoles) => {
    return (req, res, next) => {

        // Authentication should already have happened
        if (!req.user) {
            return res.redirect("/login");
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).send(
                "You do not have permission to access this page."
            );
        }

        next();
    };
};

module.exports = {
    requireRole
};