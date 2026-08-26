const multer = require('multer');
const { Router } = require("express");

const { documentExtractionController } = require('../controller/document_extraction-controller');

const document_extractionRouter = new Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 26214400
    }
});

document_extractionRouter.get('/', documentExtractionController.getDocumentExtractions);
document_extractionRouter.get('/:documentextractionid', documentExtractionController.getDocumentExtraction);
document_extractionRouter.post('/', upload.single('file'), documentExtractionController.addDocumentExtraction);
document_extractionRouter.put('/:documentextractionid', documentExtractionController.updateDocumentExtraction);
document_extractionRouter.delete('/:documentextractionid', documentExtractionController.deleteDocumentExtraction);

module.exports = {
    document_extractionRouter
};