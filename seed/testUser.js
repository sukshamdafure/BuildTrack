const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("../models/User");

dotenv.config();

const testUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected.");

        const user = await User.create({
            name: "Test Worker",
            email: "test.Worker@buildtrack.com",
            password: "testpassword123",
            role: "WORKER",
            phone: "564738290"
        });

        console.log("User created successfully:");
        console.log(user);

        await mongoose.connection.close();

        console.log("Database connection closed.");
    } catch (error) {
        console.error("Error creating test user:");
        console.error(error.message);

        await mongoose.connection.close();
    }
};

testUser();