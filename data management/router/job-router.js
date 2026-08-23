const { Router } = require("express")
const { jobController } = require("../controller/job-controller.js")

const jobRouter = new Router()

jobRouter.get("/", jobController.getJobs)
jobRouter.get("/:jobid", jobController.getJob)
jobRouter.post("/", jobController.addJob)
jobRouter.put("/:jobid", jobController.updateJob)
jobRouter.delete("/:jobid", jobController.deleteJob)

module.exports = { jobRouter }