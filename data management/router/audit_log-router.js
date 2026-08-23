const { Router } = require("express")
const { audit_logController } = require("../controller/audit_log-controller.js")

const audit_logRouter = new Router()

audit_logRouter.get("/", audit_logController.getAudit_logs)
audit_logRouter.get("/:auditlogid", audit_logController.getAudit_log)
audit_logRouter.post("/", audit_logController.addAudit_log)
audit_logRouter.put("/:auditlogid", audit_logController.updateAudit_log)
audit_logRouter.delete("/:auditlogid", audit_logController.deleteAudit_log)

module.exports = { audit_logRouter }