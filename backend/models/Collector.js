const mongoose = require("mongoose");

const collectorSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    collector_id: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    vehicle: { type: String, required: true },
    division_assigned: { type: String, required: true },
    active: { type: Boolean, default: true }
}, {
    collection: "collectors",
    versionKey: false
});

module.exports = mongoose.model("Collector", collectorSchema);