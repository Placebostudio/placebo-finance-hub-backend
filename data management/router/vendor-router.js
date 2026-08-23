const { Router } = require("express")
const { vendorController } = require("../controller/vendor-controller.js")

const vendorRouter = new Router()

vendorRouter.get("/", vendorController.getVendors)
vendorRouter.get("/:vendorid", vendorController.getVendor)
vendorRouter.post("/", vendorController.addVendor)
vendorRouter.put("/:vendorid", vendorController.updateVendor)
vendorRouter.delete("/:vendorid", vendorController.deleteVendor)

module.exports = { vendorRouter }