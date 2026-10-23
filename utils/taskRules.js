const validateTaskState = (progress, status) => {
    const numericProgress = Number(progress);

    if (
        Number.isNaN(numericProgress) ||
        numericProgress < 0 ||
        numericProgress > 100
    ) {
        return {
            valid: false,
            message: "Task progress must be between 0 and 100."
        };
    }

    if (status === "COMPLETED" && numericProgress !== 100) {
        return {
            valid: false,
            message: "A completed task must have 100% progress."
        };
    }

    if (numericProgress === 100 && status !== "COMPLETED") {
        return {
            valid: false,
            message: "A task with 100% progress must be marked as completed."
        };
    }

    if (
        numericProgress === 0 &&
        status === "COMPLETED"
    ) {
        return {
            valid: false,
            message: "A task with 0% progress cannot be completed."
        };
    }

    return {
        valid: true,
        progress: numericProgress,
        status
    };
};


module.exports = {
    validateTaskState
};