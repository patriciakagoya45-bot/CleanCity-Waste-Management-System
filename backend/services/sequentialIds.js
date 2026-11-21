const Sequence = require("../models/Sequence");

const nextSequentialId = async (sequenceId, prefix) => {
    await Sequence.updateOne(
        { _id: sequenceId },
        { $setOnInsert: { value: 0 } },
        { upsert: true }
    );
    const sequence = await Sequence.findOneAndUpdate(
        { _id: sequenceId },
        { $inc: { value: 1 } },
        { new: true }
    );
    return `${prefix}${String(sequence.value).padStart(3, "0")}`;
};

const ensureSequentialIds = async ({ Model, field, sequenceId, prefix, sort = { _id: 1 } }) => {
    await Model.init();
    const existing = await Model.find({ [field]: { $type: "string" } })
        .select(field)
        .lean();
    const expression = new RegExp(`^${prefix}(\\d+)$`);
    const currentMaximum = existing.reduce((maximum, record) => {
        const match = expression.exec(record[field] || "");
        return match ? Math.max(maximum, Number(match[1])) : maximum;
    }, 0);

    await Sequence.updateOne(
        { _id: sequenceId },
        { $setOnInsert: { value: currentMaximum } },
        { upsert: true }
    );
    await Sequence.updateOne(
        { _id: sequenceId },
        { $max: { value: currentMaximum } }
    );

    const missing = await Model.find({
        $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }]
    })
        .select("_id")
        .sort(sort)
        .lean();
    for (const record of missing) {
        const publicId = await nextSequentialId(sequenceId, prefix);
        await Model.updateOne(
            { _id: record._id, $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }] },
            { $set: { [field]: publicId } }
        );
    }
};

module.exports = { nextSequentialId, ensureSequentialIds };
