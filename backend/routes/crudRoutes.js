const express = require("express");
const createResourceController = require("../controllers/resourceController");
const { requireAuth, requireRole } = require("../middleware/auth");

const createCrudRoutes = (Model, resourceName) => {
    const router = express.Router();
    const controller = createResourceController(Model, resourceName);

    router.use(requireAuth, requireRole("administrator"));
    router.route("/")
        .get(controller.list)
        .post(controller.create);
    router.route("/:id")
        .get(controller.getById)
        .put(controller.update)
        .delete(controller.remove);

    return router;
};

module.exports = createCrudRoutes;
