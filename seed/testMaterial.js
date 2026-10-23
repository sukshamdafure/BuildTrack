const dotenv = require("dotenv");
const mongoose = require("mongoose");

const Project = require("../models/Project");
const Material = require("../models/Material");

dotenv.config();

const testMaterial = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected.");

        const project = await Project.findOne({
            name: "ABC Residential Building"
        });

        if (!project) {
            console.log(
                "Project not found. Create a project first."
            );

            await mongoose.connection.close();

            return;
        }

        const material = await Material.create({
            project: project._id,

            name: "Cement",

            unit: "bags",

            initialQuantity: 500,

            usedQuantity: 350,

            minimumStockLevel: 100,

            supplier: "ABC Building Materials",

            cost: 200000
        });

        console.log(
            "Material created successfully:"
        );

        console.log(material);

        console.log(
            `Remaining quantity: ${material.remainingQuantity} ${material.unit}`
        );

        await mongoose.connection.close();

        console.log(
            "Database connection closed."
        );

    } catch (error) {

        console.error(
            "Error creating material:"
        );

        console.error(
            error.message
        );

        await mongoose.connection.close();
    }
};

testMaterial();