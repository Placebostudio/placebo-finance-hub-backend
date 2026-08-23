const express = require('express');
const multer = require('multer');

const { document_attachmentController } = require('../controller/document_attachment-controller');

const document_attachmentRouter = new Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 26214400
    }
});

document_attachmentRouter.get('/', document_attachmentController.getDocumentAttachments);
document_attachmentRouter.get('/:document_attachmentid', document_attachmentController.getDocumentAttachment);
document_attachmentRouter.post('/', upload.single('file'), document_attachmentController.addDocumentAttachment);
document_attachmentRouter.put('/:document_attachmentid', document_attachmentController.updateDocumentAttachment);
document_attachmentRouter.delete('/:document_attachmentid', document_attachmentController.deleteDocumentAttachment);

module.exports = {
    document_attachmentRouter
};