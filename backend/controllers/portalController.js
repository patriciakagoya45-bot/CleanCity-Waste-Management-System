const { randomUUID } = require("node:crypto");
const Household = require("../models/Household");
const Collector = require("../models/Collector");
const Pickup = require("../models/Pickup");
const Payment = require("../models/Payment");
const Complaint = require("../models/Complaint");
const { wastePricesUgx, isValidServiceArea } = require("../config/referenceData");
const { nextRequestId } = require("../services/requestIds");
const { nextPaymentId } = require("../services/paymentIds");
const { parseCoordinates } = require("./authController");

const respondError = (res, error) => {
    console.error("Portal request failed:", error.message);
    res.status(500).json({ success: false, message: "Unable to complete the request" });
};

const householdProfile = async (req, res) => {
    try {
        const household = await Household.findById(req.user.linkedId);
        if (!household) return res.status(404).json({ success: false, message: "Household not found" });
        res.json({ success: true, data: household });
    } catch (error) {
        respondError(res, error);
    }
};

const requestPickup = async (req, res) => {
    try {
        const body = req.body || {};
        const pickupDate = new Date(body.pickup_date);
        const wasteType = String(body.waste_type || "").trim();
        if (!wasteType || Number.isNaN(pickupDate.getTime())) {
            return res.status(400).json({ success: false, message: "Choose a waste type and valid pickup date" });
        }
        const normalizedWasteType = wasteType.toLowerCase();
        if (!Object.hasOwn(wastePricesUgx, normalizedWasteType)) {
            return res.status(400).json({ success: false, message: "Choose a supported waste type" });
        }
        if (pickupDate < new Date(new Date().setHours(0, 0, 0, 0))) {
            return res.status(400).json({ success: false, message: "Pickup date cannot be in the past" });
        }

        const pickup = await Pickup.create({
            _id: randomUUID(),
            request_id: await nextRequestId(),
            household_id: req.user.linkedId,
            collector_id: "",
            dumpsite_id: "",
            pickup_date: pickupDate,
            waste_type: normalizedWasteType,
            weight_kg: 0,
            status: "requested",
            fee_ugx: wastePricesUgx[normalizedWasteType]
        });
        res.status(201).json({ success: true, data: pickup });
    } catch (error) {
        respondError(res, error);
    }
};

const listHouseholdRequests = async (req, res) => {
    try {
        const requests = await Pickup.find({ household_id: req.user.linkedId }).sort({ pickup_date: -1 });
        res.json({ success: true, count: requests.length, data: requests });
    } catch (error) {
        respondError(res, error);
    }
};

const cancelHouseholdRequest = async (req, res) => {
    try {
        const pickup = await Pickup.findOne({
            household_id: req.user.linkedId,
            $or: [{ request_id: req.params.id }, { _id: req.params.id }]
        });
        if (!pickup) return res.status(404).json({ success: false, message: "Request not found" });
        if (/collected|completed|cancelled/i.test(pickup.status)) {
            return res.status(400).json({ success: false, message: "This request can no longer be cancelled" });
        }
        pickup.status = "cancelled";
        await pickup.save();
        res.json({ success: true, data: pickup });
    } catch (error) {
        respondError(res, error);
    }
};

const payForRequest = async (req, res) => {
    try {
        const body = req.body || {};
        const requestReference = String(req.params.id || "").trim();
        const pickup = await Pickup.findOne({
            household_id: req.user.linkedId,
            $or: [
                { request_id: requestReference.toUpperCase() },
                { _id: requestReference }
            ]
        });
        if (!pickup) return res.status(404).json({ success: false, message: "Request not found" });
        if (/cancelled/i.test(pickup.status)) {
            return res.status(400).json({ success: false, message: "Cancelled requests cannot be paid" });
        }

        const payments = await Payment.find({ pickup_id: pickup._id, status: { $ne: "void" } });
        const paid = payments.reduce((sum, payment) => sum + payment.amount_ugx, 0);
        const due = Math.round((pickup.fee_ugx - paid) * 100) / 100;
        if (due <= 0) {
            const message = pickup.fee_ugx > 0
                ? "This request is already paid"
                : "This request does not have a fee yet";
            return res.status(400).json({ success: false, message });
        }

        const method = String(body.method || "").trim();
        if (!method) return res.status(400).json({ success: false, message: "Select a payment method" });
        const payment = await Payment.create({
            _id: randomUUID(),
            payment_id: await nextPaymentId(),
            pickup_id: pickup._id,
            household_id: req.user.linkedId,
            amount_ugx: due,
            payment_date: new Date(),
            method,
            reference: String(body.reference || "").trim(),
            status: "paid"
        });
        res.status(201).json({ success: true, data: payment });
    } catch (error) {
        respondError(res, error);
    }
};

const listHouseholdPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ household_id: req.user.linkedId }).sort({ payment_date: -1 });
        const pickups = await Pickup.find({ _id: { $in: payments.map((payment) => payment.pickup_id) } })
            .select("_id request_id");
        const requestIdByPickupId = new Map(pickups.map((pickup) => [pickup._id, pickup.request_id || pickup._id]));
        res.json({
            success: true,
            count: payments.length,
            data: payments.map((payment) => ({
                ...payment.toObject(),
                request_id: requestIdByPickupId.get(payment.pickup_id) || payment.pickup_id
            }))
        });
    } catch (error) {
        respondError(res, error);
    }
};

const fileComplaint = async (req, res) => {
    try {
        const issue = String((req.body || {}).issue || "").trim();
        if (!issue) return res.status(400).json({ success: false, message: "Describe the issue" });
        const complaint = await Complaint.create({
            _id: randomUUID(),
            household_id: req.user.linkedId,
            issue,
            complaint_date: new Date(),
            status: "open"
        });
        res.status(201).json({ success: true, data: complaint });
    } catch (error) {
        respondError(res, error);
    }
};

const listHouseholdComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find({ household_id: req.user.linkedId }).sort({ complaint_date: -1 });
        res.json({ success: true, count: complaints.length, data: complaints });
    } catch (error) {
        respondError(res, error);
    }
};

const updateHouseholdAddress = async (req, res) => {
    try {
        const body = req.body || {};
        const household = await Household.findById(req.user.linkedId);
        if (!household) return res.status(404).json({ success: false, message: "Household not found" });
        const changes = {};
        ["address", "division", "parish"].forEach((field) => {
            if (typeof body[field] === "string" && body[field].trim()) {
                changes[field] = body[field].trim();
            }
        });
        const division = changes.division || household.division;
        const parish = changes.parish || household.parish;
        if (!isValidServiceArea(division, parish)) {
            return res.status(400).json({ success: false, message: "Choose a parish within the selected division" });
        }
        const coordinates = parseCoordinates(body);
        if (coordinates === false) {
            return res.status(400).json({ success: false, message: "Provide valid GPS coordinates or leave both empty" });
        }
        if (coordinates) Object.assign(changes, coordinates);
        if (body.clearLocation === true) {
            delete changes.latitude;
            delete changes.longitude;
        }
        if (Object.keys(changes).length === 0 && body.clearLocation !== true) {
            return res.status(400).json({ success: false, message: "Provide an address, division, or parish" });
        }
        const updatedHousehold = await Household.findByIdAndUpdate(
            req.user.linkedId,
            {
                $set: changes,
                ...(body.clearLocation === true ? { $unset: { latitude: 1, longitude: 1 } } : {})
            },
            { new: true, runValidators: true }
        );
        res.json({ success: true, data: updatedHousehold });
    } catch (error) {
        respondError(res, error);
    }
};

const listAssignedPickups = async (req, res) => {
    try {
        const pickups = await Pickup.find({ collector_id: req.user.linkedId }).sort({ pickup_date: 1 });
        const householdIds = [...new Set(pickups.map((pickup) => pickup.household_id))];
        const households = await Household.find({ _id: { $in: householdIds } });
        const byId = new Map(households.map((household) => [household._id, household]));
        res.json({
            success: true,
            count: pickups.length,
            data: pickups.map((pickup) => ({
                ...pickup.toObject(),
                household: byId.get(pickup.household_id) || null
            }))
        });
    } catch (error) {
        respondError(res, error);
    }
};

const markPickupCollected = async (req, res) => {
    try {
        const body = req.body || {};
        const pickup = await Pickup.findOne({ _id: req.params.id, collector_id: req.user.linkedId });
        if (!pickup) return res.status(404).json({ success: false, message: "Assigned request not found" });
        if (/cancelled/i.test(pickup.status)) {
            return res.status(400).json({ success: false, message: "Cancelled requests cannot be collected" });
        }
        if (body.weight_kg !== undefined) {
            const weight = Number(body.weight_kg);
            if (!Number.isFinite(weight) || weight < 0) {
                return res.status(400).json({ success: false, message: "Enter a valid collected weight" });
            }
            pickup.weight_kg = weight;
        }
        pickup.status = "collected";
        await pickup.save();
        res.json({ success: true, data: pickup });
    } catch (error) {
        respondError(res, error);
    }
};

const toggleAvailability = async (req, res) => {
    try {
        const collector = await Collector.findById(req.user.linkedId);
        if (!collector) return res.status(404).json({ success: false, message: "Collector profile not found" });
        collector.active = !collector.active;
        await collector.save();
        res.json({ success: true, data: collector });
    } catch (error) {
        respondError(res, error);
    }
};

const collectorProfile = async (req, res) => {
    try {
        const collector = await Collector.findById(req.user.linkedId);
        if (!collector) return res.status(404).json({ success: false, message: "Collector profile not found" });
        res.json({ success: true, data: { ...collector.toObject(), email: req.user.email } });
    } catch (error) {
        respondError(res, error);
    }
};

module.exports = {
    householdProfile,
    requestPickup,
    listHouseholdRequests,
    cancelHouseholdRequest,
    payForRequest,
    listHouseholdPayments,
    fileComplaint,
    listHouseholdComplaints,
    updateHouseholdAddress,
    listAssignedPickups,
    markPickupCollected,
    toggleAvailability,
    collectorProfile
};
