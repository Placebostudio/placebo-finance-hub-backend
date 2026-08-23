const { Router } = require("express")
const { matchController } = require("../controller/match-controller.js")

const matchRouter = new Router()

matchRouter.get("/", matchController.getMatches)
matchRouter.get("/:matchid", matchController.getMatch)
matchRouter.get("/:expenseid", matchController.getMatchesByExpense)
matchRouter.get("/:transactionid", matchController.getMatchesByTransaction)
matchRouter.post("/", matchController.addMatch)
matchRouter.put("/:matchid", matchController.updateMatch)
matchRouter.delete("/:matchid", matchController.deleteMatch)

module.exports = { matchRouter }