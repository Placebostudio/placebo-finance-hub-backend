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


exports.documentController = {

  // ============================================================
  // GET ALL DOCUMENTS
  // ============================================================

  async getDocuments(req, res) {

    try {

      const {
        status,
        spam
      } = req.query;

      const values = [];

      const conditions = [
        "deleted_at IS NULL"
      ];

      if (status) {

        values.push(status);

        conditions.push(
          `status = $${values.length}`
        );
      }

      if (spam === "true" || spam === "false") {

        values.push(
          spam === "true"
        );

        conditions.push(
          `spam = $${values.length}`
        );
      }

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
                deleted_at,
                spam
             FROM documents
             WHERE ${conditions.join(" AND ")}
             ORDER BY uploaded_at DESC`,
        values
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
  // GET ONE DOCUMENT
  // ============================================================

  async getDocument(req, res) {

    const { documentid } = req.params;

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
                    deleted_at,
                    spam
                 FROM documents
                 WHERE id = $1
                   AND deleted_at IS NULL`,
        [documentid]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }

      const document = result.rows[0];

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(
          document.storage_path,
          60 * 10
        );

      if (error) {
        throw error;
      }

      return res.json({
        ...document,
        url: data.signedUrl
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
  // UPLOAD DOCUMENT
  //
  // 1. Validate file
  // 2. Calculate checksum
  // 3. Check duplicate
  // 4. Upload to Supabase Storage
  // 5. Create documents row
  //
  // If creating the DB row fails:
  // -> delete the uploaded file
  // ============================================================

  async uploadDocument(req, res) {

    let storagePath = null;

    try {

      const {
        uploaded_by,
        notes
      } = req.body;


      // ----------------------------------------------------
      // FILE
      // ----------------------------------------------------

      if (!req.file) {

        return res.status(400).json({
          success: false,
          error: "File is required"
        });
      }


      // ----------------------------------------------------
      // TYPE
      // ----------------------------------------------------

      if (!ALLOWED_TYPES.includes(req.file.mimetype)) {

        return res.status(400).json({
          success: false,
          error: "Unsupported file type"
        });
      }


      // ----------------------------------------------------
      // SIZE
      // ----------------------------------------------------

      if (req.file.size > MAX_FILE_SIZE) {

        return res.status(400).json({
          success: false,
          error: "File cannot exceed 20 MB"
        });
      }


      // ----------------------------------------------------
      // USER
      // ----------------------------------------------------

      if (!uploaded_by) {

        return res.status(400).json({
          success: false,
          error: "uploaded_by is required"
        });
      }


      // ----------------------------------------------------
      // CHECKSUM
      // ----------------------------------------------------

      const checksum = crypto
        .createHash("sha256")
        .update(req.file.buffer)
        .digest("hex");


      // ----------------------------------------------------
      // DUPLICATE CHECK
      // ----------------------------------------------------

      const duplicate = await db.query(
        `SELECT
                    id,
                    document_no,
                    file_name,
                    storage_path
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


      // ----------------------------------------------------
      // DOCUMENT ID
      // ----------------------------------------------------

      const documentId = crypto.randomUUID();


      // ----------------------------------------------------
      // STORAGE PATH
      // ----------------------------------------------------

      const safeFileName =
        req.file.originalname
          .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

      const fileName =
        `${Date.now()}-${safeFileName}`;

      storagePath =
        `${STORAGE_FOLDER}/${documentId}/${fileName}`;


      // ----------------------------------------------------
      // UPLOAD FILE
      // ----------------------------------------------------

      const {
        error: uploadError
      } = await supabase.storage
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


      // ----------------------------------------------------
      // CREATE DOCUMENT ROW
      // ----------------------------------------------------

      let result;

      try {

        result = await db.query(
          `INSERT INTO documents (
                        id,
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
                        spam
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11,
                        $12
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
                        deleted_at,
                        spam`,
          [
            documentId,
            req.file.originalname,
            req.file.mimetype,
            req.file.size,
            storagePath,
            checksum,
            null,
            "pending_review",
            "uploaded",
            notes ?? null,
            uploaded_by,
            false
          ]
        );

      } catch (dbError) {

        // ------------------------------------------------
        // DB FAILED
        // Remove the uploaded file so storage does not
        // contain an orphaned file.
        // ------------------------------------------------

        try {

          await supabase.storage
            .from(BUCKET_NAME)
            .remove([
              storagePath
            ]);

        } catch (cleanupError) {

          console.error(
            "Failed to clean up uploaded file:",
            cleanupError
          );
        }

        throw dbError;
      }


      // ----------------------------------------------------
      // PUBLIC URL
      // ----------------------------------------------------

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(
          storagePath,
          60 * 10
        );

      if (error) {
        throw error;
      }


      // ----------------------------------------------------
      // RETURN
      // ----------------------------------------------------

      return res.status(201).json({

        success: true,

        document: {
          ...result.rows[0],
          url: data.signedUrl
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
  // CREATE DOCUMENT WITHOUT FILE UPLOAD
  // ============================================================

  async addDocument(req, res) {

    const {
      file_name,
      file_type,
      file_size,
      storage_path,
      checksum_sha256,
      page_count,
      status = "pending_review",
      extraction_status = "uploaded",
      notes,
      uploaded_by,
      spam = false
    } = req.body;

    try {

      if (
        !file_name ||
        !file_type ||
        file_size === undefined ||
        !storage_path ||
        !checksum_sha256 ||
        !uploaded_by
      ) {

        return res.status(400).json({
          success: false,
          error:
            "file_name, file_type, file_size, storage_path, checksum_sha256 and uploaded_by are required"
        });
      }


      if (file_size > MAX_FILE_SIZE) {

        return res.status(400).json({
          success: false,
          error: "File size cannot exceed 20MB"
        });
      }


      if (typeof spam !== "boolean") {

        return res.status(400).json({
          success: false,
          error: "spam must be true or false"
        });
      }


      const result = await db.query(
        `INSERT INTO documents (
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
                    spam
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11
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
                    deleted_at,
                    spam`,
        [
          file_name,
          file_type,
          file_size,
          storage_path,
          checksum_sha256,
          page_count ?? null,
          status,
          extraction_status,
          notes ?? null,
          uploaded_by,
          spam
        ]
      );


      return res.status(201).json({
        success: true,
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
  // UPDATE DOCUMENT
  // ============================================================

  async updateDocument(req, res) {

    const { documentid } = req.params;

    const {
      file_name,
      file_type,
      file_size,
      storage_path,
      checksum_sha256,
      page_count,
      status,
      extraction_status,
      notes,
      spam,
      deleted_at
    } = req.body;


    try {

      if (
        file_size !== undefined &&
        file_size > MAX_FILE_SIZE
      ) {

        return res.status(400).json({
          success: false,
          error: "File size cannot exceed 20MB"
        });
      }


      if (
        spam !== undefined &&
        typeof spam !== "boolean"
      ) {

        return res.status(400).json({
          success: false,
          error: "spam must be true or false"
        });
      }


      const result = await db.query(
        `UPDATE documents
                 SET
                    file_name = COALESCE($1, file_name),
                    file_type = COALESCE($2, file_type),
                    file_size = COALESCE($3, file_size),
                    storage_path = COALESCE($4, storage_path),
                    checksum_sha256 = COALESCE($5, checksum_sha256),
                    page_count = COALESCE($6, page_count),
                    status = COALESCE($7, status),
                    extraction_status = COALESCE($8, extraction_status),
                    notes = COALESCE($9, notes),
                    spam = COALESCE($10, spam),
                    deleted_at = COALESCE($11, deleted_at),
                    updated_at = NOW()
                 WHERE id = $12
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
                    deleted_at,
                    spam`,
        [
          file_name ?? null,
          file_type ?? null,
          file_size ?? null,
          storage_path ?? null,
          checksum_sha256 ?? null,
          page_count ?? null,
          status ?? null,
          extraction_status ?? null,
          notes ?? null,
          spam ?? null,
          deleted_at ?? null,
          documentid
        ]
      );


      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }


      return res.json({
        success: true,
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
  // PERMANENT DELETE
  //
  // Deletes both:
  // - database row
  // - Supabase Storage file
  // ============================================================

  async deleteDocument(req, res) {

    const { documentid } = req.params;

    try {

      const result = await db.query(
        `SELECT
                    id,
                    document_no,
                    file_name,
                    storage_path,
                    spam
                 FROM documents
                 WHERE id = $1`,
        [documentid]
      );


      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }


      const document = result.rows[0];


      // ----------------------------------------------------
      // DELETE DATABASE ROW
      // ----------------------------------------------------

      await db.query(
        `DELETE FROM documents
                 WHERE id = $1`,
        [documentid]
      );


      // ----------------------------------------------------
      // DELETE STORAGE FILE
      // ----------------------------------------------------

      if (document.storage_path) {

        const {
          error: storageError
        } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([
            document.storage_path
          ]);


        if (storageError) {

          console.error(
            "Storage deletion failed:",
            storageError
          );

          return res.status(500).json({
            success: false,
            error:
              "Document deleted from database but storage deletion failed",
            document
          });
        }
      }


      return res.json({

        success: true,

        deleted: true,

        document: {
          id: document.id,
          document_no: document.document_no,
          file_name: document.file_name,
          spam: document.spam
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
  // SOFT DELETE
  // ============================================================

  async softDeleteDocument(req, res) {

    const { documentid } = req.params;

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
        [documentid]
      );


      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }


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
  // RESTORE
  // ============================================================

  async restoreDocument(req, res) {

    const { documentid } = req.params;

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
                    deleted_at,
                    spam`,
        [documentid]
      );


      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "Deleted document not found"
        });
      }


      return res.json({
        success: true,
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
  // GET ALL EXTRACTIONS
  // ============================================================

  async getExtractions(req, res) {

    const { documentid } = req.params;

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
        [documentid]
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
  // GET CURRENT EXTRACTION
  // ============================================================

  async getCurrentExtraction(req, res) {

    const { documentid } = req.params;

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
        [documentid]
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
  },


  // ============================================================
  // ADD EXTRACTION
  // ============================================================

  async addExtraction(req, res) {

    const { documentid } = req.params;

    try {

      const {
        method,
        fields,
        validation_issues = [],
        full_text,
        confidence,
        duration_ms
      } = req.body;


      // ----------------------------------------------------
      // VALIDATE METHOD
      // ----------------------------------------------------

      if (!VALID_EXTRACTION_METHODS.includes(method)) {

        return res.status(400).json({
          success: false,
          error: "Invalid extraction method"
        });
      }


      // ----------------------------------------------------
      // VALIDATE FIELDS
      // ----------------------------------------------------

      if (
        fields === undefined ||
        fields === null
      ) {

        return res.status(400).json({
          success: false,
          error: "fields is required"
        });
      }


      // ----------------------------------------------------
      // VERIFY DOCUMENT
      // ----------------------------------------------------

      const documentResult = await db.query(
        `SELECT id
                 FROM documents
                 WHERE id = $1
                   AND deleted_at IS NULL`,
        [documentid]
      );


      if (documentResult.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }


      // ----------------------------------------------------
      // MAKE OLD EXTRACTION NON-CURRENT
      // ----------------------------------------------------

      await db.query(
        `UPDATE document_extractions
                 SET is_current = FALSE
                 WHERE document_id = $1
                   AND is_current = TRUE`,
        [documentid]
      );


      // ----------------------------------------------------
      // CREATE EXTRACTION
      // ----------------------------------------------------

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
          documentid,
          method,
          fields,
          validation_issues,
          full_text ?? null,
          confidence ?? null,
          duration_ms ?? null
        ]
      );


      // ----------------------------------------------------
      // UPDATE DOCUMENT EXTRACTION STATUS
      // ----------------------------------------------------

      await db.query(
        `UPDATE documents
                 SET
                    extraction_status = 'ready_for_review',
                    updated_at = NOW()
                 WHERE id = $1`,
        [documentid]
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
  }

};