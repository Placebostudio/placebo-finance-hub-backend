const { Router } = require("express");
const multer = require("multer");

const {
    documentController
} = require("../controller/document-controller.js");

const documentRouter = new Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024 // 20 MB
    }
});

// ============================================================
// DOCUMENTS
// ============================================================

documentRouter.get("/",documentController.getDocuments);
documentRouter.get("/:documentid",documentController.getDocument);
documentRouter.post("/",upload.single("file"),documentController.uploadDocument);
documentRouter.get("/:id/file-url",documentController.getDocumentFileUrl);
documentRouter.put("/:documentid",documentController.updateDocument);
documentRouter.delete("/:documentid",documentController.deleteDocument);


// ============================================================
// DOCUMENT EXTRACTIONS
// ============================================================

documentRouter.get("/:documentid/extractions",documentController.getExtractions);
documentRouter.get("/:documentid/extractions/current",documentController.getCurrentExtraction);
documentRouter.post("/:documentid/extractions",documentController.addExtraction);


module.exports = {documentRouter};