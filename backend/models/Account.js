const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    loginId: { type: String, required: true, unique: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    name: { type: String, required: true, trim: true },
    role: {
        type: String,
        enum: ["household", "collector", "administrator"],
        required: true
    },
    linkedId: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    passwordSalt: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    passwordVersion: { type: Number, default: 0 }
}, {
    collection: "accounts",
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Account", accountSchema);
