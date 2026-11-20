const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    household_id: { type: String, required: true },
    collector_id: { type: String }, // Fixed spelling from colletor_id
    issue: { type: String, required: true },
    complaint_date: { type: Date, required: true },
    status: { type: String, required: true }
}, {
    collection: "complaints",
    versionKey: false
});

module.exports = mongoose.model("Complaint", complaintSchema);