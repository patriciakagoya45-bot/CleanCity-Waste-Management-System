const { randomBytes, randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const Account = require("../models/Account");
const Household = require("../models/Household");
const Collector = require("../models/Collector");
const Pickup = require("../models/Pickup");
const Payment = require("../models/Payment");
const Complaint = require("../models/Complaint");
const { createAccount, publicAccount, setAccountPassword } = require("./authController");
const { nextCollectorId } = require("../services/collectorIds");
const { nextPaymentId } = require("../services/paymentIds");

const fail = (res, error) => {
    console.error("Administrator request failed:", error.message);
    const status = error.status || (error.code === 11000 ? 409 : 500);
    res.status(status).json({
        success: false,
        message: status === 500 ? "Unable to complete the request" : error.message
    });
};

const listUsers = async (req, res) => {
    try {
        const filter = {};
        if (req.query.q) {
            const query = String(req.query.q).trim();
            filter.$or = [
                { loginId: { $regex: query, $options: "i" } },
                { email: { $regex: query, $options: "i" } },
                { name: { $regex: query, $options: "i" } },
                { role: { $regex: query, $options: "i" } }
            ];
        }
        const accounts = await Account.find(filter).sort({ role: 1, name: 1 });
        res.json({ success: true, count: accounts.length, data: accounts.map(publicAccount) });
    } catch (error) {
        fail(res, error);
    }
};

const registerCollector = async (req, res) => {
    let collector;
    let isNewCollector = false;
    try {
        const { collectorId, name, phone, vehicle, division_assigned, email, password } = req.body || {};
        if (![name, phone, vehicle, division_assigned].every((value) => String(value || "").trim())) {
            return res.status(400).json({
                success: false,
                message: "Complete the collector name, phone, vehicle, and assigned division"
            });
        }

        if (collectorId) {
            const rawCollectorId = String(collectorId).trim();
            collector = await Collector.findOne({
                $or: [{ _id: rawCollectorId }, { collector_id: rawCollectorId.toUpperCase() }]
            });
            if (!collector) return res.status(404).json({ success: false, message: "Existing collector not found" });
        } else {
            collector = await Collector.create({
                _id: `C-${randomUUID()}`,
                collector_id: await nextCollectorId(),
                name: String(name).trim(),
                phone: String(phone).trim(),
                vehicle: String(vehicle).trim(),
                division_assigned: String(division_assigned).trim(),
                active: true
            });
            isNewCollector = true;
        }

        const publicCollectorId = collector.collector_id || collector._id;
        if (await Account.exists({
            $or: [
                { loginId: collector._id },
                { loginId: publicCollectorId },
                { linkedId: collector._id, role: "collector" }
            ]
        })) {
            if (isNewCollector) await Collector.deleteOne({ _id: collector._id });
            return res.status(409).json({ success: false, message: "This collector already has a login" });
        }

        try {
            const account = await createAccount({
                loginId: publicCollectorId,
                email,
                name: collector.name,
                role: "collector",
                linkedId: collector._id,
                password
            });
            return res.status(201).json({
                success: true,
                message: "Collector account created",
                data: { account: publicAccount(account), collector }
            });
        } catch (error) {
            if (isNewCollector) await Collector.deleteOne({ _id: collector._id });
            throw error;
        }
    } catch (error) {
        fail(res, error);
    }
};

const deleteUser = async (req, res) => {
    try {
        const account = await Account.findById(req.params.id);
        if (!account) return res.status(404).json({ success: false, message: "User not found" });
        if (account._id === req.user.id) {
            return res.status(400).json({ success: false, message: "You cannot deactivate your own administrator account" });
        }
        account.active = false;
        await account.save();
        res.json({ success: true, message: "User login deactivated; associated service records were retained" });
    } catch (error) {
        fail(res, error);
    }
};

const resetUserPassword = async (req, res) => {
    try {
        if ((req.body || {}).identityVerified !== true) {
            return res.status(400).json({
                success: false,
                message: "Verify the user's identity against their registered details before resetting the password"
            });
        }
        const account = await Account.findById(req.params.id);
        if (!account) return res.status(404).json({ success: false, message: "User not found" });
        if (!account.active) {
            return res.status(400).json({ success: false, message: "Reactivate this account before resetting its password" });
        }

        const temporaryPassword = randomBytes(18).toString("base64url");
        await setAccountPassword(account, temporaryPassword, true);
        res.json({
            success: true,
            message: "Temporary password created. The user must change it after signing in.",
            data: {
                account: publicAccount(account),
                temporaryPassword
            }
        });
    } catch (error) {
        fail(res, error);
    }
};

const listRequests = async (req, res) => {
    try {
        const requests = await Pickup.find().sort({ pickup_date: -1 });
        const householdIds = [...new Set(requests.map((request) => request.household_id))];
        const collectorIds = [...new Set(requests.map((request) => request.collector_id).filter(Boolean))];
        const [households, collectors] = await Promise.all([
            Household.find({ _id: { $in: householdIds } }),
            Collector.find({ _id: { $in: collectorIds } })
        ]);
        const householdById = new Map(households.map((household) => [household._id, household]));
        const collectorById = new Map(collectors.map((collector) => [collector._id, collector]));
        res.json({
            success: true,
            count: requests.length,
            data: requests.map((request) => ({
                ...request.toObject(),
                household: householdById.get(request.household_id) || null,
                collector: collectorById.get(request.collector_id) || null
            }))
        });
    } catch (error) {
        fail(res, error);
    }
};

const updateRequest = async (req, res) => {
    try {
        const pickup = await Pickup.findById(req.params.id);
        if (!pickup) return res.status(404).json({ success: false, message: "Request not found" });
        const changes = {};
        const body = req.body || {};
        if (body.collector_id !== undefined) {
            const collectorId = String(body.collector_id).trim();
            if (collectorId) {
                const [collector, account] = await Promise.all([
                    Collector.findById(collectorId),
                    Account.findOne({ linkedId: collectorId, role: "collector", active: true })
                ]);
                if (!collector || !account) {
                    return res.status(400).json({ success: false, message: "Select a collector with an active login" });
                }
                if (!collector.active) {
                    return res.status(400).json({ success: false, message: "This collector is currently unavailable" });
                }
                changes.collector_id = collectorId;
                if (["requested", "unassigned"].includes(pickup.status.toLowerCase())) {
                    changes.status = "assigned";
                }
            } else {
                changes.collector_id = "";
            }
        }
        if (body.pickup_date !== undefined) {
            const date = new Date(body.pickup_date);
            if (Number.isNaN(date.getTime())) {
                return res.status(400).json({ success: false, message: "Enter a valid collection date" });
            }
            changes.pickup_date = date;
        }
        if (body.status !== undefined) {
            const status = String(body.status).trim().toLowerCase();
            if (!["requested", "assigned", "scheduled", "collected", "completed", "missed", "cancelled"].includes(status)) {
                return res.status(400).json({ success: false, message: "Choose a valid request status" });
            }
            changes.status = status;
        }
        if (body.fee_ugx !== undefined) {
            const amount = Number(body.fee_ugx);
            if (!Number.isFinite(amount) || amount < 0) {
                return res.status(400).json({ success: false, message: "Enter a valid request fee" });
            }
            changes.fee_ugx = amount;
        }
        if (body.weight_kg !== undefined) {
            const weight = Number(body.weight_kg);
            if (!Number.isFinite(weight) || weight < 0) {
                return res.status(400).json({ success: false, message: "Enter a valid collected weight" });
            }
            changes.weight_kg = weight;
        }
        if (body.waste_type !== undefined && String(body.waste_type).trim()) {
            changes.waste_type = String(body.waste_type).trim();
        }
        if (body.dumpsite_id !== undefined) changes.dumpsite_id = String(body.dumpsite_id).trim();
        if (Object.keys(changes).length === 0) {
            return res.status(400).json({ success: false, message: "Provide at least one request field to update" });
        }

        Object.assign(pickup, changes);
        await pickup.save();
        res.json({ success: true, data: pickup });
    } catch (error) {
        fail(res, error);
    }
};

const listPayments = async (req, res) => {
    try {
        const payments = await Payment.find().sort({ payment_date: -1 });
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
        fail(res, error);
    }
};

const recordPayment = async (req, res) => {
    try {
        const body = req.body || {};
        const pickupId = String(body.pickup_id || "").trim();
        const pickup = await Pickup.findOne({
            $or: [{ _id: pickupId }, { request_id: pickupId.toUpperCase() }]
        });
        if (!pickup) return res.status(404).json({ success: false, message: "Collection request not found" });
        if (/cancelled/i.test(pickup.status)) {
            return res.status(400).json({ success: false, message: "Cancelled requests cannot receive payments" });
        }

        const amount = Number(body.amount_ugx);
        const method = String(body.method || "").trim();
        if (!Number.isFinite(amount) || amount <= 0 || !method) {
            return res.status(400).json({ success: false, message: "Enter a positive amount and payment method" });
        }
        const payments = await Payment.find({ pickup_id: pickup._id, status: { $ne: "void" } });
        const paid = payments.reduce((sum, payment) => sum + payment.amount_ugx, 0);
        if (paid + amount > pickup.fee_ugx) {
            return res.status(400).json({ success: false, message: "Payment exceeds the outstanding request balance" });
        }

        const payment = await Payment.create({
            _id: randomUUID(),
            payment_id: await nextPaymentId(),
            pickup_id: pickup._id,
            household_id: pickup.household_id,
            amount_ugx: amount,
            payment_date: body.payment_date ? new Date(body.payment_date) : new Date(),
            method,
            reference: String(body.reference || "").trim(),
            status: "paid"
        });
        res.status(201).json({ success: true, data: payment });
    } catch (error) {
        fail(res, error);
    }
};

const listComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ complaint_date: -1 });
        res.json({ success: true, count: complaints.length, data: complaints });
    } catch (error) {
        fail(res, error);
    }
};

const resolveComplaint = async (req, res) => {
    try {
        const complaint = await Complaint.findByIdAndUpdate(
            req.params.id,
            { $set: { status: "resolved" } },
            { new: true, runValidators: true }
        );
        if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found" });
        res.json({ success: true, data: complaint });
    } catch (error) {
        fail(res, error);
    }
};

const summaryReport = async (req, res) => {
    try {
        const [users, requests, payments, complaints, weight] = await Promise.all([
            Account.aggregate([{ $match: { active: true } }, { $group: { _id: "$role", count: { $sum: 1 } } }]),
            Pickup.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
            Payment.aggregate([{ $match: { status: { $ne: "void" } } }, { $group: { _id: null, total: { $sum: "$amount_ugx" }, count: { $sum: 1 } } }]),
            Complaint.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
            Pickup.aggregate([{ $group: { _id: null, total: { $sum: "$weight_kg" } } }])
        ]);
        res.json({
            success: true,
            data: {
                users: Object.fromEntries(users.map((row) => [row._id, row.count])),
                requests: Object.fromEntries(requests.map((row) => [row._id, row.count])),
                payments: { count: payments[0]?.count || 0, totalUgx: payments[0]?.total || 0 },
                complaints: Object.fromEntries(complaints.map((row) => [row._id, row.count])),
                collectedWeightKg: weight[0]?.total || 0
            }
        });
    } catch (error) {
        fail(res, error);
    }
};

const saveDataNow = async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.json({
            success: true,
            message: "MongoDB is connected. Changes are persisted automatically."
        });
    } catch (error) {
        fail(res, error);
    }
};

module.exports = {
    listUsers,
    registerCollector,
    deleteUser,
    resetUserPassword,
    listRequests,
    updateRequest,
    listPayments,
    recordPayment,
    listComplaints,
    resolveComplaint,
    summaryReport,
    saveDataNow
};
