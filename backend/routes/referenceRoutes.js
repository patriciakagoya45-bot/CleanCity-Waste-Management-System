const express = require("express");
const { serviceAreas, wastePricesUgx } = require("../config/referenceData");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        data: {
            serviceAreas,
            wastePricesUgx,
            pricingBasis: "fixed per pickup"
        }
    });
});

module.exports = router;
