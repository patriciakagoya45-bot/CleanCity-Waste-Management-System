const Payment = require("../models/Payment");
const { ensureSequentialIds, nextSequentialId } = require("./sequentialIds");

const SEQUENCE_ID = "payment_public";

const nextPaymentId = () => nextSequentialId(SEQUENCE_ID, "PAY");
const ensurePaymentIds = () => ensureSequentialIds({
    Model: Payment,
    field: "payment_id",
    sequenceId: SEQUENCE_ID,
    prefix: "PAY",
    sort: { payment_date: 1, _id: 1 }
});

module.exports = { nextPaymentId, ensurePaymentIds };
