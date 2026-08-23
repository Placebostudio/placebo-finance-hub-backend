const { Router } = require("express");

const { appSettingsController } = require("../controller/app_settings-controller.js");

const appSettingsRouter = new Router();

appSettingsRouter.get("/", appSettingsController.getAppSettings);

appSettingsRouter.put("/", appSettingsController.updateAppSettings);

module.exports = { appSettingsRouter };