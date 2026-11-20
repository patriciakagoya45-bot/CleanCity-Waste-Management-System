
const Household = require("../models/Household");

// CREATE: Register a new household
const createHousehold = async (req, res) => {
    try {
        const household = new Household(req.body);
        const savedHousehold = await household.save();

        res.status(201).json({
            success: true,
            message: "Household registered successfully",
            data: savedHousehold
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.code === 11000
                ? "A household with this ID already exists"
                : error.message
        });
    }
};

// READ: Get all households
const getHouseholds = async (req, res) => {
    try {
        const households = await Household.find();

        res.status(200).json({
            success: true,
            count: households.length,
            data: households
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// READ: Get one household by ID
const getHouseholdById = async (req, res) => {
    try {
        const household = await Household.findById(req.params.id);

        if (!household) {
            return res.status(404).json({
                success: false,
                message: "Household not found"
            });
        }

        res.status(200).json({
            success: true,
            data: household
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// UPDATE: Edit household information
const updateHousehold = async (req, res) => {
    try {
        const household = await Household.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!household) {
            return res.status(404).json({
                success: false,
                message: "Household not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Household updated successfully",
            data: household
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.code === 11000
                ? "A household with this ID already exists"
                : error.message
        });
    }
};

// DELETE: Remove a household
const deleteHousehold = async (req, res) => {
    try {
        const household = await Household.findByIdAndDelete(
            req.params.id
        );

        if (!household) {
            return res.status(404).json({
                success: false,
                message: "Household not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Household deleted successfully"
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    createHousehold,
    getHouseholds,
    getHouseholdById,
    updateHousehold,
    deleteHousehold
};
