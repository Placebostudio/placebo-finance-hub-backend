const { Router } = require("express");
const { appSettingsController } = require("../controller/app_setting-controller.js");

const appSettingsRouter = new Router();

appSettingsRouter.get("/", appSettingsController.getSettings);

appSettingsRouter.put("/", appSettingsController.updateSettings);

module.exports = { appSettingsRouter };