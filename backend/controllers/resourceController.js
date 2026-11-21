const { randomUUID } = require("node:crypto");
const { nextRequestId } = require("../services/requestIds");
const { nextPaymentId } = require("../services/paymentIds");

const editableFieldsFor = (Model) =>
    Object.keys(Model.schema.paths).filter(
        (field) => field !== "_id" && field !== "__v" && field !== "request_id" && !field.includes(".")
    );

const pickEditableFields = (Model, body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new TypeError("Request body must be a JSON object");
    }

    return Object.fromEntries(
        editableFieldsFor(Model)
            .filter((field) => Object.hasOwn(body, field))
            .map((field) => [field, body[field]])
    );
};

const getErrorStatus = (error) => {
    if (
        error.code === 11000 ||
        error.name === "ValidationError" ||
        error.name === "CastError" ||
        error instanceof TypeError
    ) {
        return 400;
    }

    return 500;
};

const sendError = (res, error) =>
    res.status(getErrorStatus(error)).json({
        success: false,
        message: error.message
    });

const createResourceController = (Model, resourceName) => ({
    list: async (req, res) => {
        try {
            const records = await Model.find().sort({ _id: 1 });
            res.status(200).json({
                success: true,
                count: records.length,
                data: records
            });
        } catch (error) {
            sendError(res, error);
        }
    },

    getById: async (req, res) => {
        try {
            const record = await Model.findById(req.params.id);
            if (!record) {
                return res.status(404).json({
                    success: false,
                    message: `${resourceName} not found`
                });
            }

            res.status(200).json({ success: true, data: record });
        } catch (error) {
            sendError(res, error);
        }
    },

    create: async (req, res) => {
        try {
            const fields = pickEditableFields(Model, req.body);
            if (Model.modelName === "Pickup") {
                fields.request_id = await nextRequestId();
            }
            if (Model.modelName === "Payment") {
                fields.payment_id = await nextPaymentId();
            }
            const record = await Model.create({
                _id: req.body._id || randomUUID(),
                ...fields
            });

            res.status(201).json({
                success: true,
                message: `${resourceName} created successfully`,
                data: record
            });
        } catch (error) {
            sendError(res, error);
        }
    },

    update: async (req, res) => {
        try {
            const fields = pickEditableFields(Model, req.body);
            if (Object.keys(fields).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Provide at least one editable field"
                });
            }

            const record = await Model.findByIdAndUpdate(
                req.params.id,
                { $set: fields },
                { new: true, runValidators: true }
            );
            if (!record) {
                return res.status(404).json({
                    success: false,
                    message: `${resourceName} not found`
                });
            }

            res.status(200).json({
                success: true,
                message: `${resourceName} updated successfully`,
                data: record
            });
        } catch (error) {
            sendError(res, error);
        }
    },

    remove: async (req, res) => {
        try {
            const record = await Model.findByIdAndDelete(req.params.id);
            if (!record) {
                return res.status(404).json({
                    success: false,
                    message: `${resourceName} not found`
                });
            }

            res.status(200).json({
                success: true,
                message: `${resourceName} deleted successfully`
            });
        } catch (error) {
            sendError(res, error);
        }
    }
});

module.exports = createResourceController;
