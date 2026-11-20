const Household = require("../models/Household");
const createCrudRoutes = require("./crudRoutes");

module.exports = createCrudRoutes(Household, "Household");
