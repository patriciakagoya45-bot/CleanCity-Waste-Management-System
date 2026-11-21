const mongoose = require("mongoose");

const pickupSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    request_id: { type: String, unique: true, sparse: true },
    household_id: { type: String, required: true },
    collector_id: { type: String, default: "" },
    dumpsite_id: { type: String, default: "" },
    pickup_date: { type: Date, required: true },
    waste_type: { type: String, required: true },
    weight_kg: { type: Number, required: true },
    status: { type: String, required: true },
    fee_ugx: { type: Number, required: true }
}, {
    collection: "pickups",
    versionKey: false
});

module.exports = mongoose.model("Pickup", pickupSchema);