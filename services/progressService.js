const Task = require("../models/Task");
const Project = require("../models/Project");


const calculateProjectProgress = async (projectId) => {
    const tasks = await Task.find({
        project: projectId
    }).select("progress weight");


    if (tasks.length === 0) {
        return 0;
    }


    let totalWeight = 0;
    let weightedProgress = 0;


    for (const task of tasks) {

        const weight = Number(task.weight) || 0;
        const progress = Number(task.progress) || 0;

        totalWeight += weight;

        weightedProgress +=
            progress * weight;
    }


    if (totalWeight === 0) {
        return 0;
    }


    const projectProgress =
        weightedProgress / totalWeight;


    return Math.round(
        projectProgress * 100
    ) / 100;
};


const updateProjectProgress = async (projectId) => {

    const progress =
        await calculateProjectProgress(projectId);


    const project =
        await Project.findById(projectId);


    if (!project) {
        throw new Error("Project not found.");
    }


    project.progress = progress;

    await project.save();


    return progress;
};


module.exports = {
    calculateProjectProgress,
    updateProjectProgress
};