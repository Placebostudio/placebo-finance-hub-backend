const { Router } = require("express")
const { statementController } = require("../controller/statement-controller.js")

const statementRouter = new Router()

statementRouter.get("/", statementController.getStatements)
statementRouter.get("/:statementid", statementController.getStatement)
statementRouter.post("/", statementController.addStatement)
statementRouter.put("/:statementid", statementController.updateStatement)
statementRouter.put("/:statementid/lock", statementController.lockStatement)
statementRouter.put("/:statementid/unlock", statementController.unlockStatement)
// statementRouter.delete("/:statementid", statementController.deleteStatement)

module.exports = { statementRouter }