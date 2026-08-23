const { Router } = require("express")
const { categoryController } = require("../controller/category-controller.js")

const categoryRouter = new Router()

categoryRouter.get("/", categoryController.getCategories)
categoryRouter.get("/:categoryid", categoryController.getCategory)
categoryRouter.post("/", categoryController.addCategory)
categoryRouter.put("/:categoryid", categoryController.updateCategory)
categoryRouter.delete("/:categoryid", categoryController.deleteCategory)

module.exports = { categoryRouter }