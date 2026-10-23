const getTaskDeadlineStatus = (task) => {
    const now = new Date();

    const deadline = new Date(task.deadline);

    if (Number.isNaN(deadline.getTime())) {
        return "UNKNOWN";
    }

    /*
     * Completed tasks don't have an active deadline.
     */
    if (
        task.status === "COMPLETED" ||
        task.progress === 100
    ) {
        return "COMPLETED";
    }

    /*
     * Compare dates at midnight so that
     * time-of-day doesn't create unexpected results.
     */
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const deadlineDate = new Date(
        deadline.getFullYear(),
        deadline.getMonth(),
        deadline.getDate()
    );

    const differenceMs =
        deadlineDate.getTime() - today.getTime();

    const differenceDays =
        Math.ceil(
            differenceMs / (1000 * 60 * 60 * 24)
        );


    if (differenceDays < 0) {
        return "OVERDUE";
    }

    if (differenceDays <= 3) {
        return "APPROACHING";
    }

    return "UPCOMING";
};


const getDaysUntilDeadline = (task) => {
    const now = new Date();
    const deadline = new Date(task.deadline);

    if (Number.isNaN(deadline.getTime())) {
        return null;
    }

    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const deadlineDate = new Date(
        deadline.getFullYear(),
        deadline.getMonth(),
        deadline.getDate()
    );

    const differenceMs =
        deadlineDate.getTime() - today.getTime();

    return Math.ceil(
        differenceMs / (1000 * 60 * 60 * 24)
    );
};

const updateOverdueTasks = async (tasks) => {
    const now = new Date();

    for (const task of tasks) {

        if (
            task.status === "COMPLETED" ||
            task.progress === 100
        ) {
            continue;
        }

        const deadline = new Date(task.deadline);

        if (
            !Number.isNaN(deadline.getTime()) &&
            deadline < now &&
            task.status !== "DELAYED"
        ) {
            task.status = "DELAYED";

            await task.save();
        }
    }
};


module.exports = {
    getTaskDeadlineStatus,
    getDaysUntilDeadline,
    updateOverdueTasks
};