const db = require("../../db_connection");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

const BUCKET_NAME = "finance-hub";
const STORAGE_FOLDER = "files";

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf"
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const VALID_EXTRACTION_METHODS = [
    "pdf_text",
    "image_ocr",
    "scanned_pdf_ocr",
    "manual"
];


const document_attachmentController = {

    // ============================================================
    // GET ALL DOCUMENTS
    // ============================================================

    async getDocumentAttachments(req, res) {

        try {

            const result = await db.query(
                `SELECT
                    id,
                    document_no,
                    file_name,
                    file_type,
                    file_size,
                    storage_path,
                    checksum_sha256,
                    page_count,
                    status,
                    extraction_status,
                    notes,
                    uploaded_by,
                    uploaded_at,
                    updated_at,
                    deleted_at
                 FROM documents
                 WHERE deleted_at IS NULL
                 ORDER BY uploaded_at DESC`
            );


            const documents = result.rows.map((document) => {

                const { data } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(document.storage_path);

                return {
                    ...document,
                    url: data.publicUrl
                };
            });


            return res.json(documents);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // GET ONE DOCUMENT
    // ============================================================

    async getDocumentAttachment(req, res) {

        try {

            const result = await db.query(
                `SELECT
                    id,
                    document_no,
                    file_name,
                    file_type,
                    file_size,
                    storage_path,
                    checksum_sha256,
                    page_count,
                    status,
                    extraction_status,
                    notes,
                    uploaded_by,
                    uploaded_at,
                    updated_at,
                    deleted_at
                 FROM documents
                 WHERE id = $1
                   AND deleted_at IS NULL`,
                [req.params.document_attachmentid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Document not found"
                });
            }


            const document = result.rows[0];


            const { data } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(document.storage_path);


            return res.json({
                ...document,
                url: data.publicUrl
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // ADD DOCUMENT
    // ============================================================

    async addDocumentAttachment(req, res) {

        try {

            const {
                uploaded_by,
                notes
            } = req.body;


            // ====================================================
            // CHECK FILE
            // ====================================================

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    error: "File is required"
                });
            }


            // ====================================================
            // VALIDATE FILE TYPE
            // ====================================================

            if (!ALLOWED_TYPES.includes(req.file.mimetype)) {

                return res.status(400).json({
                    success: false,
                    error: "Unsupported file type"
                });
            }


            // ====================================================
            // VALIDATE FILE SIZE
            // ====================================================

            if (req.file.size > MAX_FILE_SIZE) {

                return res.status(400).json({
                    success: false,
                    error: "File cannot exceed 20 MB"
                });
            }


            // ====================================================
            // VALIDATE USER
            // ====================================================

            if (!uploaded_by) {

                return res.status(400).json({
                    success: false,
                    error: "uploaded_by is required"
                });
            }


            // ====================================================
            // CHECKSUM
            // ====================================================

            const checksum = crypto
                .createHash("sha256")
                .update(req.file.buffer)
                .digest("hex");


            // ====================================================
            // DUPLICATE CHECK
            // ====================================================

            const duplicate = await db.query(
                `SELECT
                    id,
                    document_no,
                    file_name,
                    deleted_at
                 FROM documents
                 WHERE checksum_sha256 = $1
                   AND deleted_at IS NULL
                 LIMIT 1`,
                [checksum]
            );


            if (duplicate.rows.length > 0) {

                return res.status(409).json({
                    success: false,
                    error: "Duplicate document",
                    document: duplicate.rows[0]
                });
            }


            // ====================================================
            // CREATE DOCUMENT ID
            // ====================================================

            const documentId = crypto.randomUUID();


            // ====================================================
            // CREATE STORAGE PATH
            // ====================================================

            const fileName =
                `${Date.now()}-${req.file.originalname}`;

            const storagePath =
                `${STORAGE_FOLDER}/${documentId}/${fileName}`;


            // ====================================================
            // UPLOAD TO SUPABASE STORAGE
            // ====================================================

            const { error: uploadError } =
                await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(
                        storagePath,
                        req.file.buffer,
                        {
                            contentType: req.file.mimetype,
                            upsert: false
                        }
                    );


            if (uploadError) {
                throw uploadError;
            }


            // ====================================================
            // CREATE DATABASE ROW
            // ====================================================

            const result = await db.query(
                `INSERT INTO documents (
                    id,
                    file_name,
                    file_type,
                    file_size,
                    storage_path,
                    checksum_sha256,
                    status,
                    extraction_status,
                    notes,
                    uploaded_by
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    'pending_review',
                    'uploaded',
                    $7,
                    $8
                )
                RETURNING
                    id,
                    document_no,
                    file_name,
                    file_type,
                    file_size,
                    storage_path,
                    checksum_sha256,
                    page_count,
                    status,
                    extraction_status,
                    notes,
                    uploaded_by,
                    uploaded_at,
                    updated_at,
                    deleted_at`,
                [
                    documentId,
                    req.file.originalname,
                    req.file.mimetype,
                    req.file.size,
                    storagePath,
                    checksum,
                    notes || null,
                    uploaded_by
                ]
            );


            // ====================================================
            // PUBLIC URL
            // ====================================================

            const { data } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(storagePath);


            return res.status(201).json({
                success: true,
                document: {
                    ...result.rows[0],
                    url: data.publicUrl
                }
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // UPDATE DOCUMENT
    // ============================================================

    async updateDocumentAttachment(req, res) {

        try {

            const {
                file_name,
                status,
                extraction_status,
                page_count,
                notes
            } = req.body;


            // ====================================================
            // VALIDATE STATUS
            // ====================================================

            const validStatuses = [
                "pending_review",
                "approved",
                "rejected"
            ];


            if (
                status !== undefined &&
                !validStatuses.includes(status)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid document status"
                });
            }


            // ====================================================
            // VALIDATE EXTRACTION STATUS
            // ====================================================

            const validExtractionStatuses = [
                "uploaded",
                "queued",
                "extracting",
                "ready_for_review",
                "failed"
            ];


            if (
                extraction_status !== undefined &&
                !validExtractionStatuses.includes(
                    extraction_status
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid extraction status"
                });
            }


            // ====================================================
            // UPDATE
            // ====================================================

            const result = await db.query(
                `UPDATE documents
                 SET
                    file_name = COALESCE($1, file_name),
                    status = COALESCE($2, status),
                    extraction_status =
                        COALESCE($3, extraction_status),
                    page_count = COALESCE($4, page_count),
                    notes = COALESCE($5, notes),
                    updated_at = NOW()
                 WHERE id = $6
                   AND deleted_at IS NULL
                 RETURNING
                    id,
                    document_no,
                    file_name,
                    file_type,
                    file_size,
                    storage_path,
                    checksum_sha256,
                    page_count,
                    status,
                    extraction_status,
                    notes,
                    uploaded_by,
                    uploaded_at,
                    updated_at,
                    deleted_at`,
                [
                    file_name ?? null,
                    status ?? null,
                    extraction_status ?? null,
                    page_count ?? null,
                    notes ?? null,
                    req.params.document_attachmentid
                ]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Document not found"
                });
            }


            const document = result.rows[0];


            const { data } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(
                    document.storage_path
                );


            return res.json({
                success: true,
                document: {
                    ...document,
                    url: data.publicUrl
                }
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // SOFT DELETE DOCUMENT
    // ============================================================

    async deleteDocumentAttachment(req, res) {

        try {

            const result = await db.query(
                `UPDATE documents
                 SET
                    deleted_at = NOW(),
                    updated_at = NOW()
                 WHERE id = $1
                   AND deleted_at IS NULL
                 RETURNING
                    id,
                    document_no,
                    file_name,
                    storage_path,
                    deleted_at`,
                [req.params.document_attachmentid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Document not found"
                });
            }


            // IMPORTANT:
            // The physical file is intentionally NOT removed
            // from Supabase Storage.
            //
            // This is a soft delete.


            return res.json({
                success: true,
                deleted: true,
                document: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // RESTORE DOCUMENT
    // ============================================================

    async restoreDocumentAttachment(req, res) {

        try {

            const result = await db.query(
                `UPDATE documents
                 SET
                    deleted_at = NULL,
                    updated_at = NOW()
                 WHERE id = $1
                   AND deleted_at IS NOT NULL
                 RETURNING
                    id,
                    document_no,
                    file_name,
                    file_type,
                    file_size,
                    storage_path,
                    checksum_sha256,
                    page_count,
                    status,
                    extraction_status,
                    notes,
                    uploaded_by,
                    uploaded_at,
                    updated_at,
                    deleted_at`,
                [req.params.document_attachmentid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Deleted document not found"
                });
            }


            const document = result.rows[0];


            const { data } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(
                    document.storage_path
                );


            return res.json({
                success: true,
                document: {
                    ...document,
                    url: data.publicUrl
                }
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // GET EXTRACTIONS
    // ============================================================

    async getExtractions(req, res) {

        try {

            const result = await db.query(
                `SELECT
                    document_id,
                    method,
                    fields,
                    validation_issues,
                    full_text,
                    confidence,
                    duration_ms,
                    is_current,
                    created_at
                 FROM document_extractions
                 WHERE document_id = $1
                 ORDER BY created_at DESC`,
                [req.params.document_attachmentid]
            );


            return res.json(result.rows);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // ADD EXTRACTION
    // ============================================================

    async addExtraction(req, res) {

        try {

            const {
                method,
                fields,
                validation_issues = [],
                full_text,
                confidence,
                duration_ms
            } = req.body;


            // ====================================================
            // VALIDATE METHOD
            // ====================================================

            if (
                !VALID_EXTRACTION_METHODS.includes(method)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid extraction method"
                });
            }


            // ====================================================
            // VALIDATE FIELDS
            // ====================================================

            if (
                fields === undefined ||
                fields === null
            ) {

                return res.status(400).json({
                    success: false,
                    error: "fields is required"
                });
            }


            // ====================================================
            // VERIFY DOCUMENT
            // ====================================================

            const documentResult = await db.query(
                `SELECT id
                 FROM documents
                 WHERE id = $1
                   AND deleted_at IS NULL`,
                [req.params.document_attachmentid]
            );


            if (documentResult.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Document not found"
                });
            }


            // ====================================================
            // REMOVE CURRENT EXTRACTION
            // ====================================================

            await db.query(
                `UPDATE document_extractions
                 SET is_current = FALSE
                 WHERE document_id = $1
                   AND is_current = TRUE`,
                [req.params.document_attachmentid]
            );


            // ====================================================
            // INSERT EXTRACTION
            // ====================================================

            const result = await db.query(
                `INSERT INTO document_extractions (
                    document_id,
                    method,
                    fields,
                    validation_issues,
                    full_text,
                    confidence,
                    duration_ms,
                    is_current
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    TRUE
                )
                RETURNING
                    document_id,
                    method,
                    fields,
                    validation_issues,
                    full_text,
                    confidence,
                    duration_ms,
                    is_current,
                    created_at`,
                [
                    req.params.document_attachmentid,
                    method,
                    fields,
                    validation_issues,
                    full_text ?? null,
                    confidence ?? null,
                    duration_ms ?? null
                ]
            );


            // ====================================================
            // UPDATE DOCUMENT STATUS
            // ====================================================

            await db.query(
                `UPDATE documents
                 SET
                    extraction_status = 'ready_for_review',
                    updated_at = NOW()
                 WHERE id = $1`,
                [req.params.document_attachmentid]
            );


            return res.status(201).json({
                success: true,
                extraction: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // GET CURRENT EXTRACTION
    // ============================================================

    async getCurrentExtraction(req, res) {

        try {

            const result = await db.query(
                `SELECT
                    document_id,
                    method,
                    fields,
                    validation_issues,
                    full_text,
                    confidence,
                    duration_ms,
                    is_current,
                    created_at
                 FROM document_extractions
                 WHERE document_id = $1
                   AND is_current = TRUE
                 LIMIT 1`,
                [req.params.document_attachmentid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Current extraction not found"
                });
            }


            return res.json(result.rows[0]);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }

};


module.exports = {
    document_attachmentController
};