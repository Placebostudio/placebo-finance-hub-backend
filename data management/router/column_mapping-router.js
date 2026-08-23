const { Router } = require("express")
const { columnMappingController } = require("../controller/column_mapping-controller.js")

const column_mappingRouter = new Router()

column_mappingRouter.get("/", columnMappingController.getColumnMappings)
column_mappingRouter.get("/:columnmappingid", columnMappingController.getColumnMapping)
column_mappingRouter.post("/", columnMappingController.addColumnMapping)
column_mappingRouter.put("/:columnmappingid", columnMappingController.updateColumnMapping)
column_mappingRouter.delete("/:columnmappingid", columnMappingController.deleteColumnMapping)

module.exports = { column_mappingRouter }