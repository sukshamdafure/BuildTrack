const Project = require("../models/Project");
const Task = require("../models/Task");
const mongoose = require("mongoose");
const DailyWorkReport = require("../models/DailyWorkReport");
const Milestone = require("../models/Milestone");

function getProjectName(project) {
  return (
    project.name ||
    project.projectName ||
    project.title ||
    "Untitled project"
  );
}

function formatDate(date) {
  if (!date) return "Not set";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not set";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

async function getClientDashboard(req, res, next) {
  try {
    // Fail explicitly if the project-to-client relationship
    // has not been configured in the existing Project schema.
    if (!Project.schema.path("client")) {
      throw new Error(
        "Client dashboard requires a Project.client reference to User. " +
        "Update the ownership query to match the existing Project schema."
      );
    }

    // Security: load only projects belonging to the signed-in Client.
    const projectDocuments = await Project.find({
      client: req.user._id
    })
      .select(
        "name projectName title status progress startDate endDate location"
      )
      .sort({ createdAt: -1 })
      .lean();

    const projectIds = projectDocuments.map(project => project._id);

    // Fetch task information only for this Client's projects.
    const tasks = projectIds.length
      ? await Task.find({
          project: { $in: projectIds }
        })
          .select("project status")
          .lean()
      : [];

    const taskSummaryByProject = {};

    const summary = {
      totalProjects: projectDocuments.length,
      totalTasks: tasks.length,
      completedTasks: 0,
      delayedTasks: 0,
      completedProjects: 0
    };

    for (const task of tasks) {
      const projectId = String(task.project);
      const status = String(task.status || "").toUpperCase();

      if (!taskSummaryByProject[projectId]) {
        taskSummaryByProject[projectId] = {
          totalTasks: 0,
          completedTasks: 0,
          delayedTasks: 0
        };
      }

      const taskSummary = taskSummaryByProject[projectId];

      taskSummary.totalTasks += 1;

      if (status === "COMPLETED") {
        taskSummary.completedTasks += 1;
        summary.completedTasks += 1;
      }

      if (status === "DELAYED") {
        taskSummary.delayedTasks += 1;
        summary.delayedTasks += 1;
      }
    }

    const projects = projectDocuments.map(project => {
      const taskSummary = taskSummaryByProject[String(project._id)] || {
        totalTasks: 0,
        completedTasks: 0,
        delayedTasks: 0
      };

      const progress = Number(project.progress);

      const normalizedProgress = Number.isFinite(progress)
        ? Math.min(100, Math.max(0, progress))
        : 0;

      const status = String(project.status || "NOT SET").toUpperCase();

      if (status === "COMPLETED") {
        summary.completedProjects += 1;
      }

      return {
        _id: project._id,
        name: getProjectName(project),
        status,
        progress: normalizedProgress,
        startDateLabel: formatDate(project.startDate),
        endDateLabel: formatDate(project.endDate),
        location: project.location || "Not specified",
        ...taskSummary
      };
    });

    return res.render("client/dashboard", {
      user: req.user,
      pageTitle: "Client Dashboard",
      projects,
      summary
    });
  } catch (error) {
    return next(error);
  }
}

// GET /client/projects/:projectId
async function getClientProjectDetails(req, res, next) {
  try {
    const { projectId } = req.params;

    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(404).send("Project not found.");
    }

    // Authorization is applied to the project query itself.
    // A Client can only open a project associated with their account.
    const project = await Project.findOne({
      _id: projectId,
      client: req.user._id
    }).lean();

    if (!project) {
      return res.status(404).send("Project not found.");
    }

    // Fetch tasks only for this authorized project.
    const tasks = await Task.find({
      project: project._id
    })
      .select(
        "title taskName name status progress startDate dueDate deadline"
      )
      .sort({ createdAt: -1 })
      .lean();

    // Fetch daily reports only for this authorized project.
    const reports = await DailyWorkReport.find({
      project: project._id
    })
      .populate({
        path: "worker",
        select: "name fullName username email"
      })
      .populate({
        path: "task",
        select: "title taskName name"
      })
      .sort({
        reportDate: -1,
        createdAt: -1
      })
      .limit(20)
      .lean();

    const completedTasks = tasks.filter(
      task => String(task.status || "").toUpperCase() === "COMPLETED"
    ).length;

    const delayedTasks = tasks.filter(
      task => String(task.status || "").toUpperCase() === "DELAYED"
    ).length;

    const normalizedProject = {
      ...project,
      displayName:
        project.name ||
        project.projectName ||
        project.title ||
        "Untitled project",
      displayStatus: String(project.status || "NOT SET").toUpperCase(),
      displayProgress: Number.isFinite(Number(project.progress))
        ? Math.min(100, Math.max(0, Number(project.progress)))
        : 0,
      startDateLabel: formatDate(project.startDate),
      endDateLabel: formatDate(project.endDate),
      displayLocation: project.location || "Not specified"
    };

    const normalizedTasks = tasks.map(task => ({
      ...task,
      displayName: task.title || task.taskName || task.name || "Untitled task",
      displayStatus: String(task.status || "NOT SET").toUpperCase(),
      displayProgress: Number.isFinite(Number(task.progress))
        ? Math.min(100, Math.max(0, Number(task.progress)))
        : 0,
      deadlineLabel: formatDate(task.dueDate || task.deadline)
    }));

    const normalizedReports = reports.map(report => ({
      ...report,
      workerLabel:
        report.worker?.name ||
        report.worker?.fullName ||
        report.worker?.username ||
        report.worker?.email ||
        "Not available",
      taskLabel:
        report.task?.title ||
        report.task?.taskName ||
        report.task?.name ||
        "Not available",
      reportDateLabel: formatDate(report.reportDate)
    }));

    return res.render("client/project-details", {
      user: req.user,
      pageTitle: normalizedProject.displayName,
      project: normalizedProject,
      tasks: normalizedTasks,
      reports: normalizedReports,
      summary: {
        totalTasks: tasks.length,
        completedTasks,
        delayedTasks
      }
    });
  } catch (error) {
    return next(error);
  }
}
// GET /client/projects
async function getClientProjects(req, res, next) {
  try {
    if (!Project.schema.path("client")) {
      throw new Error(
        "Client project listing requires the Project.client ownership field."
      );
    }

    const projectDocuments = await Project.find({
      client: req.user._id
    })
      .select(
        "name projectName title status progress startDate endDate location"
      )
      .sort({ createdAt: -1 })
      .lean();

    const projectIds = projectDocuments.map(project => project._id);

    const tasks = projectIds.length
      ? await Task.find({
          project: { $in: projectIds }
        })
          .select("project status")
          .lean()
      : [];

    const taskCounts = {};

    for (const task of tasks) {
      const id = String(task.project);

      if (!taskCounts[id]) {
        taskCounts[id] = {
          totalTasks: 0,
          completedTasks: 0,
          delayedTasks: 0
        };
      }

      taskCounts[id].totalTasks += 1;

      const status = String(task.status || "").toUpperCase();

      if (status === "COMPLETED") {
        taskCounts[id].completedTasks += 1;
      }

      if (status === "DELAYED") {
        taskCounts[id].delayedTasks += 1;
      }
    }

    const projects = projectDocuments.map(project => {
      const counts = taskCounts[String(project._id)] || {
        totalTasks: 0,
        completedTasks: 0,
        delayedTasks: 0
      };

      const progress = Number(project.progress);

      return {
        ...project,
        displayName:
          project.name ||
          project.projectName ||
          project.title ||
          "Untitled project",
        displayStatus: String(project.status || "NOT SET").toUpperCase(),
        displayProgress: Number.isFinite(progress)
          ? Math.min(100, Math.max(0, progress))
          : 0,
        startDateLabel: formatDate(project.startDate),
        endDateLabel: formatDate(project.endDate),
        displayLocation: project.location || "Not specified",
        ...counts
      };
    });

    return res.render("client/projects", {
      user: req.user,
      pageTitle: "My Projects",
      projects
    });
  } catch (error) {
    return next(error);
  }
}

// GET /client/progress
async function getClientProgress(req, res, next) {
  try {
    // 1. Fetch only projects belonging to the logged-in Client.
    const projectDocuments = await Project.find({
      client: req.user._id
    })
      .select("name projectName title progress status")
      .lean();

    const projectIds = projectDocuments.map(project => project._id);

    // 2. Fetch tasks belonging only to these projects.
    const tasks = projectIds.length
      ? await Task.find({
          project: { $in: projectIds }
        })
          .select(
            "project title taskName name status progress dueDate deadline"
          )
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // 3. Map projects by ID for efficient lookups.
    const projectMap = new Map(
      projectDocuments.map(project => [
        String(project._id),
        project
      ])
    );

    // Helper: distinguish a missing progress value from an actual 0.
    const getProgressValue = value => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return null;
      }

      const numericValue = Number(value);

      if (!Number.isFinite(numericValue)) {
        return null;
      }

      return Math.min(100, Math.max(0, numericValue));
    };

    // 4. Prepare task data for the detailed progress table.
    const normalizedTasks = tasks.map(task => {
      const status = String(
        task.status || "NOT SET"
      ).toUpperCase();

      let displayProgress = getProgressValue(task.progress);

      // A completed task is 100% if no progress value was saved.
      if (displayProgress === null && status === "COMPLETED") {
        displayProgress = 100;
      }

      const project = projectMap.get(String(task.project));

      return {
        _id: task._id,
        projectId: task.project,

        projectName: project
          ? (
              project.name ||
              project.projectName ||
              project.title ||
              "Untitled project"
            )
          : "Project",

        projectProgress: project
          ? getProgressValue(project.progress)
          : null,

        taskName:
          task.title ||
          task.taskName ||
          task.name ||
          "Untitled task",

        status,
        progress: displayProgress,

        deadlineLabel: formatDate(
          task.dueDate || task.deadline
        )
      };
    });

    // 5. Build task statistics for each project.
    const projectTaskStats = new Map();

    for (const project of projectDocuments) {
      projectTaskStats.set(String(project._id), {
        totalTasks: 0,
        completedTasks: 0,
        delayedTasks: 0
      });
    }

    for (const task of normalizedTasks) {
      const stats = projectTaskStats.get(
        String(task.projectId)
      );

      if (!stats) {
        continue;
      }

      stats.totalTasks += 1;

      if (task.status === "COMPLETED") {
        stats.completedTasks += 1;
      }

      if (task.status === "DELAYED") {
        stats.delayedTasks += 1;
      }
    }

    // 6. Prepare project-level progress cards for the UI.
    const projectSummaries = projectDocuments.map(project => {
      const stats = projectTaskStats.get(
        String(project._id)
      ) || {
        totalTasks: 0,
        completedTasks: 0,
        delayedTasks: 0
      };

      return {
        _id: project._id,

        name:
          project.name ||
          project.projectName ||
          project.title ||
          "Untitled project",

        status: String(
          project.status || "NOT SET"
        ).toUpperCase(),

        progress: getProgressValue(project.progress),

        ...stats
      };
    });

    // 7. Calculate overall task summary.
    const summary = {
      totalProjects: projectDocuments.length,

      totalTasks: normalizedTasks.length,

      completedTasks: normalizedTasks.filter(
        task => task.status === "COMPLETED"
      ).length,

      delayedTasks: normalizedTasks.filter(
        task => task.status === "DELAYED"
      ).length,

      tasksWithProgress: normalizedTasks.filter(
        task => task.progress !== null
      ).length
    };

    // 8. Render the redesigned Client Progress page.
    return res.render("client/progress", {
      user: req.user,
      pageTitle: "Project Progress",
      tasks: normalizedTasks,
      summary,
      projectSummaries
    });

  } catch (error) {
    return next(error);
  }
}
// GET /client/reports
// GET /client/reports
async function getClientReports(req, res, next) {
  try {
    const projects = await Project.find({
      client: req.user._id
    })
      .select("_id name projectName title")
      .lean();

    const projectIds = projects.map(project => project._id);

    const projectNames = new Map(
      projects.map(project => [
        String(project._id),
        project.name ||
          project.projectName ||
          project.title ||
          "Untitled project"
      ])
    );

    const reportDocuments = projectIds.length
      ? await DailyWorkReport.find({
          project: { $in: projectIds }
        })
          .select(
            "project task worker reportDate status photos createdAt"
          )
          .populate({
            path: "worker",
            select: "name fullName username email"
          })
          .populate({
            path: "task",
            select: "title taskName name"
          })
          .sort({
            reportDate: -1,
            createdAt: -1
          })
          .limit(100)
          .lean()
      : [];

    const reports = reportDocuments.map(report => ({
      _id: report._id,
      projectId: report.project,

      projectName:
        projectNames.get(String(report.project)) ||
        "Project",

      workerName:
        report.worker?.name ||
        report.worker?.fullName ||
        report.worker?.username ||
        report.worker?.email ||
        "Not available",

      taskName:
        report.task?.title ||
        report.task?.taskName ||
        report.task?.name ||
        "Not available",

      reportDateLabel: formatDate(report.reportDate),
      status: report.status || "PENDING",

      photoCount: Array.isArray(report.photos)
        ? report.photos.length
        : 0
    }));

    const summary = {
      totalReports: reports.length,

      pendingReports: reports.filter(
        report => report.status === "PENDING"
      ).length,

      reviewedReports: reports.filter(
        report => report.status === "REVIEWED"
      ).length,

      reportsWithPhotos: reports.filter(
        report => report.photoCount > 0
      ).length
    };

    return res.render("client/reports", {
      user: req.user,
      pageTitle: "Daily Work Reports",
      reports,
      summary
    });
  } catch (error) {
    return next(error);
  }
}

// GET /client/reports/:reportId
async function getClientReportDetails(req, res, next) {
  try {
    const { reportId } = req.params;

    if (!mongoose.isValidObjectId(reportId)) {
      return res.status(404).send("Report not found.");
    }

    // Verify which projects belong to this Client.
    const projects = await Project.find({
      client: req.user._id
    })
      .select("_id")
      .lean();

    const projectIds = projects.map(project => project._id);

    // The report must belong to one of the Client's own projects.
    const report = projectIds.length
      ? await DailyWorkReport.findOne({
          _id: reportId,
          project: { $in: projectIds }
        })
          .populate({
            path: "project",
            select: "name projectName title"
          })
          .populate({
            path: "worker",
            select: "name fullName username email"
          })
          .populate({
            path: "task",
            select: "title taskName name"
          })
          .populate({
            path: "reviewedBy",
            select: "name fullName username email"
          })
          .lean()
      : null;

    if (!report) {
      return res.status(404).send("Report not found.");
    }

    const reportView = {
      ...report,

      projectName:
        report.project?.name ||
        report.project?.projectName ||
        report.project?.title ||
        "Project",

      workerName:
        report.worker?.name ||
        report.worker?.fullName ||
        report.worker?.username ||
        report.worker?.email ||
        "Not available",

      taskName:
        report.task?.title ||
        report.task?.taskName ||
        report.task?.name ||
        "Not available",

      reviewerName:
        report.reviewedBy?.name ||
        report.reviewedBy?.fullName ||
        report.reviewedBy?.username ||
        report.reviewedBy?.email ||
        "Not available",

      reportDateLabel: formatDate(report.reportDate),

      reviewedAtLabel: report.reviewedAt
        ? new Date(report.reviewedAt).toLocaleString("en-IN")
        : "Not reviewed"
    };

    return res.render("client/report-details", {
      user: req.user,
      pageTitle: "Daily Report Details",
      report: reportView
    });
  } catch (error) {
    return next(error);
  }
}
// GET /client/milestones

async function getClientMilestones(req, res, next) {
  try {
    const projects = await Project.find({ client: req.user._id })
      .select("_id name projectName title")
      .lean();

    const projectIds = projects.map(project => project._id);

    const projectNames = new Map(
      projects.map(project => [
        String(project._id),
        project.name ||
          project.projectName ||
          project.title ||
          "Untitled project"
      ])
    );

    const records = projectIds.length
      ? await Milestone.find({ project: { $in: projectIds } })
          .sort({ targetDate: 1, createdAt: -1 })
          .lean()
      : [];

    const now = new Date();

    const milestones = records.map(record => {
      const targetDate = record.targetDate
        ? new Date(record.targetDate)
        : null;

      const status = String(record.status || "UPCOMING").toUpperCase();
      let displayStatus = status;

      if (
        status !== "COMPLETED" &&
        status !== "DELAYED" &&
        targetDate &&
        !Number.isNaN(targetDate.getTime()) &&
        targetDate < now
      ) {
        displayStatus = "OVERDUE";
      }

      return {
        ...record,

        // These aliases keep the current client EJS view compatible.
        title: record.name,
        projectName:
          projectNames.get(String(record.project)) || "Project",
        dueDateLabel: formatDate(record.targetDate),
        completedAtLabel: formatDate(record.completionDate),
        displayStatus
      };
    });

    const summary = {
      total: milestones.length,
      planned: milestones.filter(
        item => item.displayStatus === "UPCOMING"
      ).length,
      inProgress: milestones.filter(
        item => item.displayStatus === "IN_PROGRESS"
      ).length,
      completed: milestones.filter(
        item => item.displayStatus === "COMPLETED"
      ).length,
      delayed: milestones.filter(
        item =>
          item.displayStatus === "DELAYED" ||
          item.displayStatus === "OVERDUE"
      ).length
    };

    return res.render("client/milestones", {
      user: req.user,
      pageTitle: "Project Milestones",
      milestones,
      summary
    });
  } catch (error) {
    return next(error);
  }
}


module.exports = {
  getClientDashboard,
  getClientProjectDetails,
  getClientProjects,
  getClientProgress,
  getClientReports,
  getClientReportDetails,
  getClientMilestones
};