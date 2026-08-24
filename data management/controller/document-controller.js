const db = require("../../db_connection");

exports.documentController = {

  // ============================================================
  // GET ALL DOCUMENTS
  // ============================================================
  async getDocuments(req, res) {
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
        WHERE deleted_at IS NULL
        ORDER BY uploaded_at DESC`
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
  // CREATE DOCUMENT
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

      if (file_size > 20971520) {
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
  //
  // Can update any normal editable fields.
  // spam can also be updated by itself.
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

      if (file_size !== undefined && file_size > 20971520) {
        return res.status(400).json({
          success: false,
          error: "File size cannot exceed 20MB"
        });
      }

      if (spam !== undefined && typeof spam !== "boolean") {
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

      return res.status(200).json({
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
  // DELETE DOCUMENT — PERMANENT
  // ============================================================
  async deleteDocument(req, res) {
    const { documentid } = req.params;

    try {

      const result = await db.query(
        `DELETE FROM documents
         WHERE id = $1
         RETURNING
           id,
           document_no,
           file_name,
           spam`,
        [documentid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Document not found"
        });
      }

      return res.status(200).json({
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

      return res.status(200).json({
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
  }
};