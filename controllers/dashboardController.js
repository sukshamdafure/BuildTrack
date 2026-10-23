const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");

const DailyWorkReport = require("../models/DailyWorkReport");
const WorkerProgressUpdate = require("../models/WorkerProgressUpdate");


function dashboardLabel(record, fields, fallback = "Not available") {
    if (typeof record === "string" && record.trim()) {
        return record.trim();
    }

    if (!record || typeof record !== "object") {
        return fallback;
    }

    for (const field of fields) {
        const value = record[field];

        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return fallback;
}

function dashboardFormatDate(value, includeTime = false) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleString(
        "en-IN",
        includeTime
            ? {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
              }
            : {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
              }
    );
}

function dashboardDateTimestamp(value) {
    const date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime())
        ? date.getTime()
        : 0;
}

const getEngineerDashboard = async (req, res) => {
    try {
        // 1. Fetch projects assigned to the logged-in engineer.
        const projects = await Project.find({
            engineer: req.user._id
        })
            .select(
                "_id name projectName title location siteLocation address city progress overallProgress status"
            )
            .sort({ createdAt: -1 })
            .lean();

        const projectIds = projects.map(project => project._id);

        const projectNames = new Map(
            projects.map(project => [
                String(project._id),
                dashboardLabel(
                    project,
                    ["name", "projectName", "title"],
                    "Untitled project"
                )
            ])
        );

        let tasks = [];
        let reports = [];
        let workerUpdates = [];

        // 2. Fetch tasks, reports and progress updates in parallel.
        if (projectIds.length > 0) {
            [tasks, reports, workerUpdates] = await Promise.all([
                Task.find({
                    project: { $in: projectIds }
                })
                    .select(
                        "_id title taskName name project status progress dueDate deadline endDate targetDate due_date priority createdAt updatedAt"
                    )
                    .sort({ updatedAt: -1, createdAt: -1 })
                    .limit(500)
                    .lean(),

                DailyWorkReport.find({
                    project: { $in: projectIds }
                })
                    .select(
                        "project status reportDate createdAt updatedAt"
                    )
                    .sort({ createdAt: -1, reportDate: -1 })
                    .limit(10)
                    .lean(),

                WorkerProgressUpdate.find({
                    project: { $in: projectIds }
                })
                    .select(
                        "project status createdAt updatedAt proposedProgress"
                    )
                    .sort({ updatedAt: -1, createdAt: -1 })
                    .limit(10)
                    .lean()
            ]);
        }

        // 3. Calculate project progress.
        // Use task progress as a fallback if project progress is not stored.
        const progressByProject = new Map();

        for (const task of tasks) {
            if (task.progress == null) continue;

            const progress = Number(task.progress);

            if (!Number.isFinite(progress)) continue;

            const projectKey = String(task.project);

            if (!progressByProject.has(projectKey)) {
                progressByProject.set(projectKey, []);
            }

            progressByProject.get(projectKey).push(
                Math.min(100, Math.max(0, progress))
            );
        }

        const dashboardProjects = projects.map(project => {
            const projectKey = String(project._id);
            const taskProgress =
                progressByProject.get(projectKey) || [];

            const averageTaskProgress = taskProgress.length
                ? Math.round(
                      taskProgress.reduce(
                          (sum, value) => sum + value,
                          0
                      ) / taskProgress.length
                  )
                : 0;

            const storedProgress =
                project.progress ?? project.overallProgress;

            const numericProgress =
                storedProgress !== "" && storedProgress != null
                    ? Number(storedProgress)
                    : NaN;

            const progress = Number.isFinite(numericProgress)
                ? Math.round(
                      Math.min(100, Math.max(0, numericProgress))
                  )
                : averageTaskProgress;

            const rawStatus = String(
                project.status || "ACTIVE"
            ).toUpperCase();

            const completed =
                progress >= 100 ||
                ["COMPLETED", "COMPLETE", "CLOSED"].includes(
                    rawStatus
                );

            let location = dashboardLabel(
                project,
                ["location", "siteLocation", "address", "city"],
                "Location not set"
            );

            if (
                project.location &&
                typeof project.location === "object"
            ) {
                location = dashboardLabel(
                    project.location,
                    ["address", "city", "name"],
                    "Location not set"
                );
            }

            return {
                _id: project._id,
                name: projectNames.get(projectKey),
                location,
                progress,
                statusLabel: completed
                    ? "COMPLETED"
                    : rawStatus.replace(/_/g, " "),
                statusClass: completed
                    ? "status-completed"
                    : "status-active"
            };
        });

        // 4. KPI summary cards.
        const completedProjects = dashboardProjects.filter(
            project => project.statusClass === "status-completed"
        ).length;

        const activeProjects =
            dashboardProjects.length - completedProjects;

        const averageProgress = dashboardProjects.length
            ? Math.round(
                  dashboardProjects.reduce(
                      (sum, project) => sum + project.progress,
                      0
                  ) / dashboardProjects.length
              )
            : 0;

        const isTaskCompleted = task => {
            const status = String(
                task.status || ""
            ).toUpperCase();

            return (
                [
                    "COMPLETED",
                    "COMPLETE",
                    "DONE",
                    "CLOSED"
                ].includes(status) ||
                Number(task.progress || 0) >= 100
            );
        };

        // 5. Count overdue unfinished tasks.
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdueTasks = tasks.filter(task => {
            const rawDate =
                task.dueDate ||
                task.deadline ||
                task.endDate ||
                task.targetDate ||
                task.due_date;

            if (!rawDate || isTaskCompleted(task)) {
                return false;
            }

            const dueDate = new Date(rawDate);

            return (
                !Number.isNaN(dueDate.getTime()) &&
                dueDate < today
            );
        }).length;

        // 6. Count pending worker updates and daily reports.
        const [
            pendingWorkerReviews,
            pendingReportReviews
        ] = projectIds.length
            ? await Promise.all([
                  WorkerProgressUpdate.countDocuments({
                      project: { $in: projectIds },
                      status: "PENDING"
                  }),

                  DailyWorkReport.countDocuments({
                      project: { $in: projectIds },
                      status: "PENDING"
                  })
              ])
            : [0, 0];

        const dashboardStats = {
            totalProjects: dashboardProjects.length,
            activeProjects,
            completedProjects,
            averageProgress,
            overdueTasks,
            pendingReviews:
                pendingWorkerReviews + pendingReportReviews
        };

        // 7. Project progress chart data.
        const chartProjects = dashboardProjects.slice(0, 6);

        const projectChartLabels = chartProjects.map(
            project => project.name
        );

        const projectChartValues = chartProjects.map(
            project => project.progress
        );

        // 8. Task status doughnut chart data.
        const taskStatusCounts = {
            "Not started": 0,
            "In progress": 0,
            "Completed": 0
        };

        tasks.forEach(task => {
            if (isTaskCompleted(task)) {
                taskStatusCounts["Completed"]++;
                return;
            }

            const status = String(
                task.status || ""
            ).toUpperCase();

            if (
                status.includes("PROGRESS") ||
                status === "ACTIVE" ||
                status === "DELAYED"
            ) {
                taskStatusCounts["In progress"]++;
            } else {
                taskStatusCounts["Not started"]++;
            }
        });

        const taskChartLabels = Object.keys(taskStatusCounts);
        const taskChartValues = Object.values(taskStatusCounts);

        // 9. Compact recent activity.
        // Show event type, project and timestamp only.
        const reportActivities = reports.map(report => {
            const date = report.createdAt || report.reportDate;

            return {
                type: "REPORT",
                title: "Daily report submitted",
                projectName:
                    projectNames.get(String(report.project)) ||
                    "Project",
                timestamp: dashboardDateTimestamp(date),
                dateLabel: dashboardFormatDate(date, true)
            };
        });

        const updateActivities = workerUpdates.map(update => {
            const status = String(
                update.status || "PENDING"
            ).toUpperCase();

            const activityTitles = {
                PENDING: "Progress submitted",
                REVIEWING: "Progress under review",
                APPROVED: "Progress approved",
                REJECTED: "Progress rejected"
            };

            const date = update.updatedAt || update.createdAt;

            return {
                type: "PROGRESS",
                title:
                    activityTitles[status] ||
                    "Progress update",
                projectName:
                    projectNames.get(String(update.project)) ||
                    "Project",
                timestamp: dashboardDateTimestamp(date),
                dateLabel: dashboardFormatDate(date, true)
            };
        });

        const recentActivities = [
            ...reportActivities,
            ...updateActivities
        ]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5);

        // 10. Upcoming deadlines: overdue tasks plus the
        // next 30 days, excluding completed tasks.
        const deadlineHorizon = new Date(today);
        deadlineHorizon.setDate(
            deadlineHorizon.getDate() + 30
        );

        const upcomingDeadlines = tasks
            .map(task => {
                const rawDate =
                    task.dueDate ||
                    task.deadline ||
                    task.endDate ||
                    task.targetDate ||
                    task.due_date;

                const dueDate = rawDate
                    ? new Date(rawDate)
                    : null;

                const rawPriority = String(
                    task.priority || "MEDIUM"
                ).toUpperCase();

                const priority =
                    rawPriority.includes("HIGH") ||
                    rawPriority === "URGENT"
                        ? "HIGH"
                        : rawPriority.includes("LOW")
                          ? "LOW"
                          : "MEDIUM";

                return {
                    title: dashboardLabel(
                        task,
                        ["title", "taskName", "name"],
                        "Untitled task"
                    ),
                    projectName:
                        projectNames.get(String(task.project)) ||
                        "Project",
                    dueDate,
                    priority,
                    priorityClass:
                        `priority-${priority.toLowerCase()}`,
                    completed: isTaskCompleted(task)
                };
            })
            .filter(item =>
                item.dueDate &&
                !Number.isNaN(item.dueDate.getTime()) &&
                !item.completed &&
                item.dueDate <= deadlineHorizon
            )
            .sort((a, b) => {
                const aOverdue = a.dueDate < today;
                const bOverdue = b.dueDate < today;

                if (aOverdue !== bOverdue) {
                    return aOverdue ? -1 : 1;
                }

                return a.dueDate - b.dueDate;
            })
            .slice(0, 5)
            .map(item => ({
                ...item,
                deadlineLabel: dashboardFormatDate(item.dueDate),
                isOverdue: item.dueDate < today
            }));

        // 11. Render the analytics dashboard.
        return res.render("engineer/dashboard", {
            user: req.user,
            projects: dashboardProjects,
            upcomingDeadlines,
            recentActivities,
            dashboardStats,
            projectChartLabels,
            projectChartValues,
            taskChartLabels,
            taskChartValues
        });

    } catch (error) {
        console.error(
            "Engineer dashboard error:",
            error
        );

        return res.status(500).send(
            "Unable to load engineer dashboard."
        );
    }
};


const getWorkerDashboard = async (req, res) => {
    try {
        const tasks = await Task.find({
            assignedWorkers: req.user._id
        })
            .populate("project", "name")
            .sort({ deadline: 1 });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        // Tasks not yet completed
        const activeTasks = tasks.filter(
            task => task.status !== "COMPLETED" &&
                    Number(task.progress) < 100
        );

        // Completed tasks
        const completedTasks = tasks.filter(
            task => task.status === "COMPLETED" ||
                    Number(task.progress) === 100
        );

        // Tasks scheduled for today
        const todaysTasks = activeTasks.filter(task => {
            if (!task.startDate || !task.deadline) return false;

            const startDate = new Date(task.startDate);
            const deadline = new Date(task.deadline);

            return startDate < tomorrow && deadline >= today;
        });

        // Deadlines within the next 7 days
        const upcomingDeadlines = activeTasks.filter(task => {
            if (!task.deadline) return false;

            const deadline = new Date(task.deadline);

            return deadline >= today && deadline < nextWeek;
        });

        // Tasks that are overdue or marked delayed
        const delayedTasks = activeTasks.filter(task => {
            if (task.status === "DELAYED") return true;
            if (!task.deadline) return false;

            return new Date(task.deadline) < today;
        });

        res.render("worker/dashboard", {
            user: req.user,
            tasks,
            activeTasks,
            completedTasks,
            todaysTasks,
            upcomingDeadlines,
            delayedTasks
        });

    } catch (error) {
        console.error(
            "Worker dashboard error:",
            error
        );

        res.status(500).send(
            "Unable to load worker dashboard."
        );
    }
};



const getClientDashboard = async (req, res) => {
    try {
        res.render("client/dashboard", {
            user: req.user
        });
    } catch (error) {
        console.error(
            "Client dashboard error:",
            error.message
        );

        res.status(500).send(
            "Unable to load client dashboard."
        );
    }
};


const getAdminDashboard = async (req, res) => {
    try {
        res.render("admin/dashboard", {
            user: req.user
        });
    } catch (error) {
        console.error(
            "Admin dashboard error:",
            error.message
        );

        res.status(500).send(
            "Unable to load admin dashboard."
        );
    }
};


module.exports = {
    getEngineerDashboard,
    getWorkerDashboard,
    getClientDashboard,
    getAdminDashboard
};