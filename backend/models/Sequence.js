const mongoose = require("mongoose");

const sequenceSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 }
}, {
    collection: "sequences",
    versionKey: false
});

module.exports = mongoose.model("Sequence", sequenceSchema);
