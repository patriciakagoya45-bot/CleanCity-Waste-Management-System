
const mongoose = require("mongoose");

const householdSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    HouseholdName: { type: String, required: true },
    phone: { type: String, required: true },
    division: { type: String, required: true },
    parish: { type: String, required: true },
    address: { type: String, required: true },
    plan: { type: String, required: true },

    // Existing records use different date field names
    registered_on: { type: Date },
    registered: { type: Date }

}, {
    collection: "households",
    versionKey: false
});

module.exports = mongoose.model("Household", householdSchema);
