
const mongoose = require("mongoose");

const dumpsiteSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    division: { type: String, required: true },

    // Your existing database stores this as a string
    capacity_tonnes: { type: String, required: true },

    // Some records contain arrays, while D4 contains a string
    accepts: { type: mongoose.Schema.Types.Mixed, required: true }

}, {
    collection: "dumpsites",
    versionKey: false
});

module.exports = mongoose.model("Dumpsite", dumpsiteSchema);
