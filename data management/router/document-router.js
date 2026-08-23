const { Router } = require("express")
const { documentController } = require("../controller/document-controller.js")

const documentRouter = new Router()

documentRouter.get("/", documentController.getDocuments)
documentRouter.get("/:documentid", documentController.getDocument)
documentRouter.post("/", documentController.addDocument)
documentRouter.put("/:documentid", documentController.updateDocument)
documentRouter.delete("/:documentid", documentController.deleteDocument)

module.exports = { documentRouter }