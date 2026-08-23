const { Router } = require("express")
const { projectController } = require("../controller/project-controller.js")

const projectRouter = new Router()

projectRouter.get("/", projectController.getProjects)
projectRouter.get("/:projectid", projectController.getProject)
projectRouter.post("/", projectController.addProject)
projectRouter.put("/:projectid", projectController.updateProject)
projectRouter.delete("/:projectid", projectController.deleteProject)

module.exports = { projectRouter }