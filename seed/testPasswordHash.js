const mongoose = require("mongoose");
const dotenv = require("dotenv");

const User = require("../models/User");

dotenv.config();

const testPasswordHash = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected");

        const testEmail =
            "password-test@buildtrack.com";

        // Remove previous test user
        await User.deleteOne({
            email: testEmail
        });

        // Create user
        const user = await User.create({
            name: "Password Test User",
            email: testEmail,
            password: "password123",
            role: "WORKER"
        });

        console.log("\nUser created:");
        console.log("Email:", user.email);

        console.log(
            "Password returned:",
            user.password
        );

        // Retrieve password explicitly
        const savedUser = await User.findOne({
            email: testEmail
        }).select("+password");

        console.log(
            "\nStored password hash:"
        );

        console.log(savedUser.password);

        // Correct password
        const correctPassword =
            await savedUser.comparePassword(
                "password123"
            );

        console.log(
            "\nCorrect password:",
            correctPassword
        );

        // Incorrect password
        const wrongPassword =
            await savedUser.comparePassword(
                "wrongpassword"
            );

        console.log(
            "Wrong password:",
            wrongPassword
        );

        console.log(
            "\nPassword hashing test completed."
        );

    } catch (error) {
        console.error("Error:");
        console.error(error.message);

    } finally {
        await mongoose.connection.close();
    }
};

testPasswordHash();