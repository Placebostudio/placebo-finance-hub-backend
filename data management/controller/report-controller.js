const db = require("../../db_connection");

const reportController = {

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


    async addReport(req, res) {
        try {
            const {
                period,
                project_id,
                kind,
                storage_path,
                generated_by,
                is_current = true
            } = req.body;

            const result = await db.query(`
                INSERT INTO reports (
                    period,
                    project_id,
                    kind,
                    storage_path,
                    generated_by,
                    is_current
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [
                period,
                project_id || null,
                kind,
                storage_path,
                generated_by || null,
                is_current
            ]);

            res.status(201).json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async updateReport(req, res) {
        try {
            const {
                period,
                project_id,
                kind,
                storage_path,
                generated_by,
                is_current
            } = req.body;

            const result = await db.query(`
                UPDATE reports
                SET
                    period = COALESCE($1, period),
                    project_id = COALESCE($2, project_id),
                    kind = COALESCE($3, kind),
                    storage_path = COALESCE($4, storage_path),
                    generated_by = COALESCE($5, generated_by),
                    is_current = COALESCE($6, is_current)
                WHERE id = $7
                RETURNING *
            `, [
                period,
                project_id,
                kind,
                storage_path,
                generated_by,
                is_current,
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