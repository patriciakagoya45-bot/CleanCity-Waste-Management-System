const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    pickup_id: { type: String, required: true },
    household_id: { type: String, required: true },
    amount_ugx: { type: Number, required: true, min: 1 },
    payment_date: { type: Date, required: true, default: Date.now },
    method: { type: String, required: true, trim: true },
    reference: { type: String, trim: true, default: "" },
    status: { type: String, required: true, default: "paid" }
}, {
    collection: "payments",
    versionKey: false
});

module.exports = mongoose.model("Payment", paymentSchema);
