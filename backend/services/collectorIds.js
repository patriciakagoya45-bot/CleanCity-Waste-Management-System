const Account = require("../models/Account");
const Collector = require("../models/Collector");
const { ensureSequentialIds, nextSequentialId } = require("./sequentialIds");

const SEQUENCE_ID = "collector_public";

const nextCollectorId = () => nextSequentialId(SEQUENCE_ID, "COL");

const ensureCollectorIds = async () => {
    await ensureSequentialIds({
        Model: Collector,
        field: "collector_id",
        sequenceId: SEQUENCE_ID,
        prefix: "COL",
        sort: { _id: 1 }
    });

    const collectors = await Collector.find({ collector_id: { $type: "string" } })
        .select("_id collector_id")
        .lean();
    for (const collector of collectors) {
        await Account.updateMany(
            { role: "collector", linkedId: collector._id, loginId: { $ne: collector.collector_id } },
            { $set: { loginId: collector.collector_id } }
        );
    }
};

module.exports = { nextCollectorId, ensureCollectorIds };
