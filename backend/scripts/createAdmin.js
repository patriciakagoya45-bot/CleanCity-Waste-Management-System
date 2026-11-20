require("dotenv").config();

const connectDB = require("../config/database");
const Account = require("../models/Account");
const { createAccount } = require("../controllers/authController");

const createAdmin = async () => {
    const loginId = String(process.env.ADMIN_ID || "").trim();
    const email = String(process.env.ADMIN_EMAIL || "").trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!loginId || !email || !password) {
        throw new Error("Set ADMIN_ID, ADMIN_EMAIL, and ADMIN_PASSWORD in .env before running setup:admin");
    }

    const existing = await Account.findOne({
        $or: [{ loginId }, { email: email.toLowerCase() }]
    });
    if (existing) {
        throw new Error("An account already uses this administrator ID or email");
    }

    const account = await createAccount({
        loginId,
        email,
        name: process.env.ADMIN_NAME || "System Administrator",
        role: "administrator",
        linkedId: loginId,
        password
    });

    console.log(`Administrator created. Sign in with ID "${account.loginId}" or email "${account.email}".`);
};

connectDB()
    .then(createAdmin)
    .then(() => process.exitCode = 0)
    .catch((error) => {
        console.error("Administrator setup failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => require("mongoose").disconnect());
