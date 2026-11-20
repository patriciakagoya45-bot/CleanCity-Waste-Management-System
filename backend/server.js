// Import required packages
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("node:path");
const connectDB = require("./config/database");
const Household = require("./models/Household");
const Collector = require("./models/Collector");
const Dumpsite = require("./models/Dumpsite");
const Pickup = require("./models/Pickup");
const Complaint = require("./models/Complaint");
require("./models/Account");
require("./models/Payment");

// Import routes
const householdRoutes = require("./routes/householdRoutes");
const createCrudRoutes = require("./routes/crudRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const portalRoutes = require("./routes/portalRoutes");

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Authentication and role-specific portals
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/portal", portalRoutes);

// Mount Routes
app.use("/api/households", householdRoutes);
app.use("/api/collectors", createCrudRoutes(Collector, "Collector"));
app.use("/api/dumpsites", createCrudRoutes(Dumpsite, "Dumpsite"));
app.use("/api/pickups", createCrudRoutes(Pickup, "Pickup"));
app.use("/api/complaints", createCrudRoutes(Complaint, "Complaint"));

// Test route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.use(express.static(path.join(__dirname, "..", "frontend")));

// API health check
app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        message: "CleanCity API is running successfully",
        database: "cleancity_db",
        databaseStatus: require("mongoose").connection.readyState === 1 ? "connected" : "disconnected"
    });
});

// Server port
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, HOST, () => {
            console.log(`CleanCity server running at http://localhost:${PORT}`);
            if (HOST === "0.0.0.0" || HOST === "::") {
                console.log(`For other devices on this network, use this computer's local IP address and port ${PORT}.`);
            }
        });
    } catch (error) {
        console.error("Failed to start CleanCity server:", error.message);
        process.exitCode = 1;
    }
};

if (require.main === module) {
    startServer();
}

module.exports = app;