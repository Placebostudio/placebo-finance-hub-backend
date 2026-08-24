const { Router } = require("express");

const { matchController } =
    require("../controller/match-controller.js");

const matchRouter = new Router();

matchRouter.get("/", matchController.getMatches);
matchRouter.get("/expense/:expenseid", matchController.getMatchesByExpense);
matchRouter.get("/transaction/:transactionid", matchController.getMatchesByTransaction);
matchRouter.get("/:matchid", matchController.getMatch);
matchRouter.post("/", matchController.addMatch);
matchRouter.put("/:matchid", matchController.updateMatch);
matchRouter.delete("/:matchid", matchController.deleteMatch);

module.exports = { matchRouter };