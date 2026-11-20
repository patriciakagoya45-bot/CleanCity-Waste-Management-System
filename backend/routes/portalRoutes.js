const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const portal = require("../controllers/portalController");

const router = express.Router();

router.use(requireAuth);
router.get("/household/profile", requireRole("household"), portal.householdProfile);
router.patch("/household/address", requireRole("household"), portal.updateHouseholdAddress);
router.route("/household/requests")
    .get(requireRole("household"), portal.listHouseholdRequests)
    .post(requireRole("household"), portal.requestPickup);
router.post("/household/requests/:id/cancel", requireRole("household"), portal.cancelHouseholdRequest);
router.post("/household/requests/:id/pay", requireRole("household"), portal.payForRequest);
router.get("/household/payments", requireRole("household"), portal.listHouseholdPayments);
router.route("/household/complaints")
    .get(requireRole("household"), portal.listHouseholdComplaints)
    .post(requireRole("household"), portal.fileComplaint);

router.get("/collector/profile", requireRole("collector"), portal.collectorProfile);
router.get("/collector/requests", requireRole("collector"), portal.listAssignedPickups);
router.post("/collector/requests/:id/collected", requireRole("collector"), portal.markPickupCollected);
router.post("/collector/availability", requireRole("collector"), portal.toggleAvailability);

module.exports = router;
