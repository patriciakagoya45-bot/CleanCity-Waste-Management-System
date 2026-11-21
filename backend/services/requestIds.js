const Pickup = require("../models/Pickup");
const Sequence = require("../models/Sequence");

const SEQUENCE_ID = "pickup_request";

const nextRequestId = async () => {
    await Sequence.updateOne(
        { _id: SEQUENCE_ID },
        { $setOnInsert: { value: 0 } },
        { upsert: true }
    );
    const sequence = await Sequence.findOneAndUpdate(
        { _id: SEQUENCE_ID },
        { $inc: { value: 1 } },
        { new: true }
    );
    return `REQ${String(sequence.value).padStart(3, "0")}`;
};

const ensureRequestIds = async () => {
    await Pickup.init();
    const existing = await Pickup.find({ request_id: { $exists: true } })
        .select("request_id")
        .lean();
    const currentMaximum = existing.reduce((maximum, pickup) => {
        const match = /^REQ(\d+)$/.exec(pickup.request_id || "");
        return match ? Math.max(maximum, Number(match[1])) : maximum;
    }, 0);
    await Sequence.updateOne(
        { _id: SEQUENCE_ID },
        { $setOnInsert: { value: currentMaximum } },
        { upsert: true }
    );
    await Sequence.updateOne(
        { _id: SEQUENCE_ID },
        { $max: { value: currentMaximum } }
    );

    const missing = await Pickup.find({ request_id: { $exists: false } })
        .select("_id")
        .sort({ pickup_date: 1, _id: 1 })
        .lean();
    for (const pickup of missing) {
        const requestId = await nextRequestId();
        await Pickup.updateOne(
            { _id: pickup._id, request_id: { $exists: false } },
            { $set: { request_id: requestId } }
        );
    }
};

module.exports = { nextRequestId, ensureRequestIds };
