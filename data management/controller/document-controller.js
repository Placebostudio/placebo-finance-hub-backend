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

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const VALID_EXTRACTION_METHODS = [
  "pdf_text",
  "image_ocr",
  "scanned_pdf_ocr",
  "manual"
];

exports.documentController = {

  // ============================================================
  // GET ALL DOCUMENTS
  // GET /
  // ============================================================

  async getDocuments(req, res) {

    try {

      const {
        status,
        spam,
        user_id
      } = req.query;

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "user_id is required"
        });
      }

      const userResult = await db.query(
        `
        SELECT
          id,
          role,
          is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "User account is inactive"
        });
      }

      if (
        !["viewer", "manager", "owner"].includes(user.role)
      ) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to perform this action"
        });
      }

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

      if (
        spam === "true" ||
        spam === "false"
      ) {

        values.push(
          spam === "true"
        );

        conditions.push(
          `spam = $${values.length}`
        );
      }

      const result = await db.query(
        `
        SELECT
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
        ORDER BY uploaded_at DESC
        `,
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
  // GET /:documentid
  // ============================================================

  async getDocument(req, res) {

    const { documentid } = req.params;
    const { user_id } = req.query;

    try {

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "user_id is required"
        });
      }

      const userResult = await db.query(
        `
        SELECT
          id,
          role,
          is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "User account is inactive"
        });
      }

      if (
        !["viewer", "manager", "owner"].includes(user.role)
      ) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to perform this action"
        });
      }

      const result = await db.query(
        `
        SELECT
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
          AND deleted_at IS NULL
        `,
        [documentid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }

      const document = result.rows[0];

      const {
        data,
        error
      } = await supabase.storage
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
  // POST /
  // ============================================================

  async uploadDocument(req, res) {

    let storagePath = null;

    try {

      const {
        notes,
        user_id
      } = req.body;

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "user_id is required"
        });
      }

      const userResult = await db.query(
        `
        SELECT
          id,
          role,
          is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "User account is inactive"
        });
      }

      if (
        !["manager", "owner"].includes(user.role)
      ) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to perform this action"
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "File is required"
        });
      }

      if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: "Unsupported file type"
        });
      }

      if (req.file.size > MAX_FILE_SIZE) {
        return res.status(400).json({
          success: false,
          error: "File cannot exceed 20 MB"
        });
      }

      const checksum = crypto
        .createHash("sha256")
        .update(req.file.buffer)
        .digest("hex");

      const duplicate = await db.query(
        `
        SELECT
          id,
          document_no,
          file_name,
          storage_path
        FROM documents
        WHERE checksum_sha256 = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [checksum]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: "Duplicate document",
          document: duplicate.rows[0]
        });
      }

      const documentId = crypto.randomUUID();

      const safeFileName =
        req.file.originalname.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

      const fileName =
        `${Date.now()}-${safeFileName}`;

      storagePath =
        `${STORAGE_FOLDER}/${documentId}/${fileName}`;

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

      let result;

      try {

        result = await db.query(
          `
          INSERT INTO documents (
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
            spam
          `,
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
            user_id,
            false
          ]
        );

      } catch (dbError) {

        await supabase.storage
          .from(BUCKET_NAME)
          .remove([storagePath])
          .catch((cleanupError) => {
            console.error(
              "Failed to clean up uploaded file:",
              cleanupError
            );
          });

        throw dbError;
      }

      const {
        data,
        error
      } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(
          storagePath,
          60 * 10
        );

      if (error) {
        throw error;
      }

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
  // GET DOCUMENT FILE URL
  // GET /:id/file-url
  // ============================================================

  async getDocumentFileUrl(req, res) {

    const { id } = req.params;
    const { user_id } = req.query;

    try {

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "user_id is required"
        });
      }

      const userResult = await db.query(
        `
        SELECT
          id,
          role,
          is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "User account is inactive"
        });
      }

      if (
        !["viewer", "manager", "owner"].includes(user.role)
      ) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to perform this action"
        });
      }

      const result = await db.query(
        `
        SELECT
          storage_path
        FROM documents
        WHERE id = $1
          AND deleted_at IS NULL
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }

      const storagePath =
        result.rows[0].storage_path;

      if (!storagePath) {
        return res.status(404).json({
          success: false,
          error: "Document has no storage file"
        });
      }

      const {
        data,
        error
      } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(
          storagePath,
          60 * 10
        );

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
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
  // UPDATE DOCUMENT
  // PUT /:documentid
  //
  // Also handles soft delete / restore through deleted_at.
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
      deleted_at,
      user_id
    } = req.body;

    try {

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "user_id is required"
        });
      }

      const userResult = await db.query(
        `
        SELECT
          id,
          role,
          is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "User account is inactive"
        });
      }

      if (
        !["manager", "owner"].includes(user.role)
      ) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to perform this action"
        });
      }

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
        `
        UPDATE documents
        SET
          file_name =
            COALESCE($1, file_name),

          file_type =
            COALESCE($2, file_type),

          file_size =
            COALESCE($3, file_size),

          storage_path =
            COALESCE($4, storage_path),

          checksum_sha256 =
            COALESCE($5, checksum_sha256),

          page_count =
            COALESCE($6, page_count),

          status =
            COALESCE($7, status),

          extraction_status =
            COALESCE($8, extraction_status),

          notes =
            COALESCE($9, notes),

          spam =
            COALESCE($10, spam),

          deleted_at =
            COALESCE($11, deleted_at),

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
          spam
        `,
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
  // DELETE /:documentid
  // ============================================================

  async deleteDocument(req, res) {

    const { documentid } = req.params;
    const { user_id } = req.body;

    try {

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "user_id is required"
        });
      }

      const userResult = await db.query(
        `
        SELECT
          id,
          role,
          is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "User account is inactive"
        });
      }

      if (user.role !== "owner") {
        return res.status(403).json({
          success: false,
          error: "Only owners can permanently delete documents"
        });
      }

      const result = await db.query(
        `
        SELECT
          id,
          document_no,
          file_name,
          storage_path,
          spam
        FROM documents
        WHERE id = $1
        `,
        [documentid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }

      const document = result.rows[0];

      if (document.storage_path) {

        const lastSlash =
          document.storage_path.lastIndexOf("/");

        const folder =
          lastSlash >= 0
            ? document.storage_path.substring(
                0,
                lastSlash + 1
              )
            : "";

        const {
          data: files,
          error: listError
        } = await supabase.storage
          .from(BUCKET_NAME)
          .list(folder);

        if (listError) {
          return res.status(500).json({
            success: false,
            error: "Failed to find document storage files"
          });
        }

        const storageFiles =
          (files || []).map(
            (file) =>
              `${folder}${file.name}`
          );

        if (storageFiles.length > 0) {

          const {
            error: storageError
          } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(storageFiles);

          if (storageError) {
            return res.status(500).json({
              success: false,
              error: "Failed to delete document files from storage"
            });
          }
        }
      }

      await db.query(
        `
        DELETE FROM documents
        WHERE id = $1
        `,
        [documentid]
      );

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
  // GET ALL EXTRACTIONS
  // GET /:documentid/extractions
  // ============================================================

  async getExtractions(req, res) {

    const { documentid } = req.params;
    const { user_id } = req.query;

    try {

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "user_id is required"
        });
      }

      const userResult = await db.query(
        `
        SELECT
          id,
          role,
          is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "User account is inactive"
        });
      }

      if (
        !["viewer", "manager", "owner"].includes(user.role)
      ) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to perform this action"
        });
      }

      const result = await db.query(
        `
        SELECT
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
        ORDER BY created_at DESC
        `,
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
  // GET /:documentid/extractions/current
  // ============================================================

  async getCurrentExtraction(req, res) {

    const { documentid } = req.params;
    const { user_id } = req.query;

    try {

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "user_id is required"
        });
      }

      const userResult = await db.query(
        `
        SELECT
          id,
          role,
          is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "User account is inactive"
        });
      }

      if (
        !["viewer", "manager", "owner"].includes(user.role)
      ) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to perform this action"
        });
      }

      const result = await db.query(
        `
        SELECT
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
        LIMIT 1
        `,
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
  // POST /:documentid/extractions
  // ============================================================

  async addExtraction(req, res) {

    const { documentid } = req.params;

    const {
      method,
      fields,
      validation_issues = [],
      full_text,
      confidence,
      duration_ms,
      user_id
    } = req.body;

    try {

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "user_id is required"
        });
      }

      const userResult = await db.query(
        `
        SELECT
          id,
          role,
          is_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "User account is inactive"
        });
      }

      if (
        !["manager", "owner"].includes(user.role)
      ) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to perform this action"
        });
      }

      if (!VALID_EXTRACTION_METHODS.includes(method)) {
        return res.status(400).json({
          success: false,
          error: "Invalid extraction method"
        });
      }

      if (
        fields === undefined ||
        fields === null
      ) {
        return res.status(400).json({
          success: false,
          error: "fields is required"
        });
      }

      const documentResult = await db.query(
        `
        SELECT
          id
        FROM documents
        WHERE id = $1
          AND deleted_at IS NULL
        `,
        [documentid]
      );

      if (documentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }

      await db.query(
        `
        UPDATE document_extractions
        SET
          is_current = FALSE
        WHERE document_id = $1
          AND is_current = TRUE
        `,
        [documentid]
      );

      const result = await db.query(
        `
        INSERT INTO document_extractions (
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
          created_at
        `,
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

      await db.query(
        `
        UPDATE documents
        SET
          extraction_status = 'ready_for_review',
          updated_at = NOW()
        WHERE id = $1
        `,
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