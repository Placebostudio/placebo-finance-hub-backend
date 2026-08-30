const { Router } = require("express")
const { transactionController } = require("../controller/transaction-controller.js")

const transactionRouter = new Router()

transactionRouter.get("/", transactionController.getTransactions)
transactionRouter.get("/:transactionid", transactionController.getTransaction)
transactionRouter.post("/", transactionController.addTransaction)
transactionRouter.post("/bulk", transactionController.createBulk);
transactionRouter.put("/:transactionid", transactionController.updateTransaction)
transactionRouter.delete("/:transactionid", transactionController.deleteTransaction)

module.exports = { transactionRouter }