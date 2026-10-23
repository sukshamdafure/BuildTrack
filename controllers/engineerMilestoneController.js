
const mongoose = require("mongoose");

const Project = require("../models/Project");
const Milestone = require("../models/Milestone");

const MILESTONE_STATUSES = [
  "UPCOMING",
  "IN_PROGRESS",
  "COMPLETED",
  "DELAYED"
];

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getProjectName(project) {
  if (!project) return "Untitled project";

  return (
    project.name ||
    project.projectName ||
    project.title ||
    "Untitled project"
  );
}

async function getEngineerProjects(engineerId) {
  return Project.find({ engineer: engineerId })
    .select("_id name projectName title")
    .sort({ name: 1 })
    .lean();
}

// Keep the existing EJS form names, then map them to the real schema.
function getFormValues(body = {}) {
  return {
    title: typeof body.title === "string" ? body.title.trim() : "",
    description:
      typeof body.description === "string"
        ? body.description.trim()
        : "",
    project: typeof body.project === "string" ? body.project : "",
    dueDate: typeof body.dueDate === "string" ? body.dueDate : "",
    status: typeof body.status === "string"
      ? body.status
      : "UPCOMING"
  };
}

function validateMilestone(values) {
  const errors = [];

  if (values.title.length < 3) {
    errors.push("Milestone name must contain at least 3 characters.");
  } else if (values.title.length > 150) {
    errors.push("Milestone name cannot exceed 150 characters.");
  }

  if (values.description.length > 1000) {
    errors.push("Description cannot exceed 1000 characters.");
  }

  const targetDate = new Date(values.dueDate);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(values.dueDate) ||
    Number.isNaN(targetDate.getTime()) ||
    targetDate.toISOString().slice(0, 10) !== values.dueDate
  ) {
    errors.push("Please enter a valid target date.");
  }

  if (!MILESTONE_STATUSES.includes(values.status)) {
    errors.push("Please select a valid milestone status.");
  }

  return { errors, targetDate };
}

async function renderMilestoneForm(
  req,
  res,
  { mode, milestone, errors = [], statusCode = 200 }
) {
  const projects = await getEngineerProjects(req.user._id);

  return res.status(statusCode).render("engineer/milestone-form", {
    user: req.user,
    pageTitle: mode === "edit" ? "Edit Milestone" : "Create Milestone",
    mode,
    milestone,
    projects,
    errors,
    statuses: MILESTONE_STATUSES
  });
}

// GET /engineer/milestones
async function getEngineerMilestones(req, res, next) {
  try {
    const projects = await getEngineerProjects(req.user._id);
    const projectIds = projects.map(project => project._id);

    const records = projectIds.length
      ? await Milestone.find({ project: { $in: projectIds } })
          .sort({ targetDate: 1, createdAt: -1 })
          .lean()
      : [];

    const projectNames = new Map(
      projects.map(project => [
        String(project._id),
        getProjectName(project)
      ])
    );

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
        // Display aliases let the existing list view continue to work.
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

    return res.render("engineer/milestones", {
      user: req.user,
      pageTitle: "Manage Milestones",
      milestones,
      summary
    });
  } catch (error) {
    return next(error);
  }
}

// GET /engineer/milestones/new
async function showCreateMilestoneForm(req, res, next) {
  try {
    return await renderMilestoneForm(req, res, {
      mode: "create",
      milestone: {
        title: "",
        description: "",
        project: "",
        dueDate: "",
        status: "UPCOMING"
      }
    });
  } catch (error) {
    return next(error);
  }
}

// POST /engineer/milestones
async function createEngineerMilestone(req, res, next) {
  try {
    const values = getFormValues(req.body);
    const { errors, targetDate } = validateMilestone(values);

    let authorizedProject = null;

    if (mongoose.isValidObjectId(values.project)) {
      authorizedProject = await Project.findOne({
        _id: values.project,
        engineer: req.user._id
      })
        .select("_id")
        .lean();
    }

    if (!authorizedProject) {
      errors.push("Select a project assigned to you.");
    }

    if (errors.length) {
      return await renderMilestoneForm(req, res, {
        mode: "create",
        milestone: values,
        errors,
        statusCode: 400
      });
    }

    await Milestone.create({
      project: authorizedProject._id,
      name: values.title,
      description: values.description,
      targetDate,
      status: values.status,
      completionDate:
        values.status === "COMPLETED" ? new Date() : null,
      progress: values.status === "COMPLETED" ? 100 : 0
    });

    return res.redirect("/engineer/milestones");
  } catch (error) {
    return next(error);
  }
}

// GET /engineer/milestones/:milestoneId/edit
async function showEditMilestoneForm(req, res, next) {
  try {
    const { milestoneId } = req.params;

    if (!mongoose.isValidObjectId(milestoneId)) {
      return res.status(404).send("Milestone not found.");
    }

    const projects = await getEngineerProjects(req.user._id);
    const projectIds = projects.map(project => project._id);

    const record = await Milestone.findOne({
      _id: milestoneId,
      project: { $in: projectIds }
    }).lean();

    if (!record) {
      return res.status(404).send("Milestone not found.");
    }

    return res.render("engineer/milestone-form", {
      user: req.user,
      pageTitle: "Edit Milestone",
      mode: "edit",
      projects,
      statuses: MILESTONE_STATUSES,
      errors: [],
      milestone: {
        ...record,
        // The form uses title and dueDate as input names.
        title: record.name,
        project: String(record.project),
        dueDate: record.targetDate
          ? new Date(record.targetDate).toISOString().slice(0, 10)
          : ""
      }
    });
  } catch (error) {
    return next(error);
  }
}

// POST /engineer/milestones/:milestoneId
async function updateEngineerMilestone(req, res, next) {
  try {
    const { milestoneId } = req.params;

    if (!mongoose.isValidObjectId(milestoneId)) {
      return res.status(404).send("Milestone not found.");
    }

    const projects = await getEngineerProjects(req.user._id);
    const projectIds = projects.map(project => project._id);

    const existingMilestone = await Milestone.findOne({
      _id: milestoneId,
      project: { $in: projectIds }
    });

    if (!existingMilestone) {
      return res.status(404).send("Milestone not found.");
    }

    const values = getFormValues(req.body);
    const { errors, targetDate } = validateMilestone(values);

    let authorizedProject = null;

    if (mongoose.isValidObjectId(values.project)) {
      authorizedProject = await Project.findOne({
        _id: values.project,
        engineer: req.user._id
      })
        .select("_id")
        .lean();
    }

    if (!authorizedProject) {
      errors.push("Select a project assigned to you.");
    }

    if (errors.length) {
      return await renderMilestoneForm(req, res, {
        mode: "edit",
        milestone: {
          ...values,
          _id: milestoneId
        },
        errors,
        statusCode: 400
      });
    }

    existingMilestone.project = authorizedProject._id;
    existingMilestone.name = values.title;
    existingMilestone.description = values.description;
    existingMilestone.targetDate = targetDate;
    existingMilestone.status = values.status;

    if (values.status === "COMPLETED") {
      existingMilestone.completionDate =
        existingMilestone.completionDate || new Date();
      existingMilestone.progress = 100;
    } else {
      existingMilestone.completionDate = null;
    }

    await existingMilestone.save();

    return res.redirect("/engineer/milestones");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getEngineerMilestones,
  showCreateMilestoneForm,
  createEngineerMilestone,
  showEditMilestoneForm,
  updateEngineerMilestone
};
