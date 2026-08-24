const { Router } = require("express")
const { reportController } = require("../controller/report-controller.js")

const reportRouter = new Router()

reportRouter.get("/", reportController.getReports)
reportRouter.get("/expense-ledger", reportController.getExpenseLedger)
reportRouter.get("/:reportid", reportController.getReport)
reportRouter.post("/", reportController.addReport)
reportRouter.put("/:reportid", reportController.updateReport)
reportRouter.delete("/:reportid", reportController.deleteReport)

module.exports = { reportRouter }