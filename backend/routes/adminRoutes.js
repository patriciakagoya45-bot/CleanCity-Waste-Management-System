const express = require("express");
const admin = require("../controllers/adminController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("administrator"));
router.get("/users", admin.listUsers);
router.post("/collectors", admin.registerCollector);
router.delete("/users/:id", admin.deleteUser);
router.post("/users/:id/reset-password", admin.resetUserPassword);
router.get("/requests", admin.listRequests);
router.patch("/requests/:id", admin.updateRequest);
router.get("/payments", admin.listPayments);
router.post("/payments", admin.recordPayment);
router.get("/complaints", admin.listComplaints);
router.post("/complaints/:id/resolve", admin.resolveComplaint);
router.get("/report", admin.summaryReport);
router.post("/save", admin.saveDataNow);

module.exports = router;
