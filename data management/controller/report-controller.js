const db = require("../../db_connection");

const reportController = {

    // ============================================================
    // GET ALL REPORTS
    // ============================================================

    async getReports(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM reports
                ORDER BY generated_at DESC
            `);

            res.json(result.rows);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    // ============================================================
    // GET ONE REPORT
    // ============================================================

    async getReport(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM reports
                WHERE id = $1
            `, [req.params.reportid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Report not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    // ============================================================
    // CREATE REPORT
    // ============================================================

    async addReport(req, res) {
        try {
            const {
                period,
                project_id,
                kind,
                storage_path,
                generated_by,
                is_current = true,
                spam = false
            } = req.body;


            // ====================================================
            // VALIDATE SPAM
            // ====================================================

            if (typeof spam !== "boolean") {
                return res.status(400).json({
                    error: "spam must be true or false"
                });
            }


            const result = await db.query(`
                INSERT INTO reports (
                    period,
                    project_id,
                    kind,
                    storage_path,
                    generated_by,
                    is_current,
                    spam
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                period,
                project_id || null,
                kind,
                storage_path,
                generated_by || null,
                is_current,
                spam
            ]);

            res.status(201).json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    // ============================================================
    // UPDATE REPORT
    //
    // Can update:
    // - all normal fields
    // - only spam
    // - normal fields + spam
    // ============================================================

    async updateReport(req, res) {
        try {
            const {
                period,
                project_id,
                kind,
                storage_path,
                generated_by,
                is_current,
                spam
            } = req.body;


            // ====================================================
            // VALIDATE SPAM
            // ====================================================

            if (
                spam !== undefined &&
                typeof spam !== "boolean"
            ) {
                return res.status(400).json({
                    error: "spam must be true or false"
                });
            }


            const result = await db.query(`
                UPDATE reports
                SET
                    period = COALESCE($1, period),
                    project_id = COALESCE($2, project_id),
                    kind = COALESCE($3, kind),
                    storage_path = COALESCE($4, storage_path),
                    generated_by = COALESCE($5, generated_by),
                    is_current = COALESCE($6, is_current),
                    spam = COALESCE($7, spam)
                WHERE id = $8
                RETURNING *
            `, [
                period ?? null,
                project_id ?? null,
                kind ?? null,
                storage_path ?? null,
                generated_by ?? null,
                is_current ?? null,
                spam !== undefined ? spam : null,
                req.params.reportid
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Report not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    // ============================================================
    // DELETE REPORT
    // ============================================================

    async deleteReport(req, res) {
        try {
            const result = await db.query(`
                DELETE FROM reports
                WHERE id = $1
                RETURNING *
            `, [req.params.reportid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Report not found"
                });
            }

            res.json({
                success: true,
                report: result.rows[0]
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = {
    reportController
};