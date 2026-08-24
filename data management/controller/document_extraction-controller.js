const db = require("../../db_connection");

exports.documentExtractionController = {

  // ============================================================
  // GET ALL DOCUMENT EXTRACTIONS
  // ============================================================

  async getDocumentExtractions(req, res) {

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
          spam,
          created_at
        FROM document_extractions
        ORDER BY created_at DESC`
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
  // GET ONE DOCUMENT EXTRACTION
  // ============================================================

  async getDocumentExtraction(req, res) {

    const { documentextractionid } = req.params;

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
          spam,
          created_at
        FROM document_extractions
        WHERE document_id = $1`,
        [documentextractionid]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "Document extraction not found"
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
  // CREATE DOCUMENT EXTRACTION
  // ============================================================

  async addDocumentExtraction(req, res) {

    const {
      document_id,
      method,
      fields,
      validation_issues = [],
      full_text,
      confidence,
      duration_ms,
      is_current = false,
      spam = false
    } = req.body;

    try {

      if (
        !document_id ||
        !method ||
        fields === undefined
      ) {

        return res.status(400).json({
          success: false,
          error: "document_id, method and fields are required"
        });
      }


      // ========================================================
      // IF THIS EXTRACTION IS CURRENT,
      // REMOVE CURRENT FROM THE PREVIOUS EXTRACTION
      // ========================================================

      if (is_current === true) {

        await db.query(
          `UPDATE document_extractions
           SET is_current = false
           WHERE document_id = $1
             AND is_current = true`,
          [document_id]
        );
      }


      const result = await db.query(
        `INSERT INTO document_extractions (
          document_id,
          method,
          fields,
          validation_issues,
          full_text,
          confidence,
          duration_ms,
          is_current,
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
          $9
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
          spam,
          created_at`,
        [
          document_id,
          method,
          fields,
          validation_issues,
          full_text ?? null,
          confidence ?? null,
          duration_ms ?? null,
          is_current,
          spam
        ]
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
  // UPDATE DOCUMENT EXTRACTION
  // ============================================================

  async updateDocumentExtraction(req, res) {

    const { documentextractionid } = req.params;

    const {
      method,
      fields,
      validation_issues,
      full_text,
      confidence,
      duration_ms,
      is_current,
      spam
    } = req.body;

    try {

      // ========================================================
      // IF SETTING AS CURRENT,
      // REMOVE CURRENT FROM OTHER EXTRACTIONS
      // ========================================================

      if (is_current === true) {

        const current = await db.query(
          `SELECT document_id
           FROM document_extractions
           WHERE document_id = $1`,
          [documentextractionid]
        );

        if (current.rows.length === 0) {

          return res.status(404).json({
            success: false,
            error: "Document extraction not found"
          });
        }

        await db.query(
          `UPDATE document_extractions
           SET is_current = false
           WHERE document_id = $1
             AND is_current = true`,
          [current.rows[0].document_id]
        );
      }


      const result = await db.query(
        `UPDATE document_extractions
         SET
           method = COALESCE($1, method),
           fields = COALESCE($2, fields),
           validation_issues = COALESCE($3, validation_issues),
           full_text = COALESCE($4, full_text),
           confidence = COALESCE($5, confidence),
           duration_ms = COALESCE($6, duration_ms),
           is_current = COALESCE($7, is_current),
           spam = COALESCE($8, spam)
         WHERE document_id = $9
         RETURNING
           document_id,
           method,
           fields,
           validation_issues,
           full_text,
           confidence,
           duration_ms,
           is_current,
           spam,
           created_at`,
        [
          method ?? null,
          fields ?? null,
          validation_issues ?? null,
          full_text ?? null,
          confidence ?? null,
          duration_ms ?? null,
          is_current ?? null,
          spam ?? null,
          documentextractionid
        ]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "Document extraction not found"
        });
      }

      return res.json({
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
  // DELETE DOCUMENT EXTRACTION
  // ============================================================

  async deleteDocumentExtraction(req, res) {

    const { documentextractionid } = req.params;

    try {

      const result = await db.query(
        `DELETE FROM document_extractions
         WHERE document_id = $1
         RETURNING
           document_id,
           method,
           fields,
           validation_issues,
           full_text,
           confidence,
           duration_ms,
           is_current,
           spam,
           created_at`,
        [documentextractionid]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "Document extraction not found"
        });
      }

      return res.json({
        success: true,
        deleted: result.rows[0]
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