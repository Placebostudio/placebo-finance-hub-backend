const { Router } = require("express")
const { expenseController } = require("../controller/expense-controller.js")

const expenseRouter = new Router()

expenseRouter.get("/", expenseController.getExpenses)
expenseRouter.get("/:expenseid", expenseController.getExpense)
expenseRouter.post("/", expenseController.addExpense)
expenseRouter.put("/:expenseid", expenseController.updateExpense)
expenseRouter.delete("/:expenseid", expenseController.deleteExpense)

module.exports = { expenseRouter }