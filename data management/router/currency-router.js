const { Router } = require("express")
const { currencyController } = require("../controller/currency-controller.js")

const currencyRouter = new Router()

currencyRouter.get("/", currencyController.getCurrencies)
currencyRouter.get("/:currency", currencyController.getCurrency)
// currencyRouter.post("/", currencyController.addCurrency)
currencyRouter.put("/:currency", currencyController.updateCurrencies)
currencyRouter.delete("/:currency", currencyController.deleteCurrency)

module.exports = { currencyRouter }