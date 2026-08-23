const db = require("../../db_connection");

const jobController = {

    async getJobs(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM jobs
                ORDER BY started_at DESC NULLS LAST
            `);

            res.json(result.rows);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async getJob(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM jobs
                WHERE id = $1
            `, [req.params.jobid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Job not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async addJob(req, res) {
        try {
            const {
                job_type,
                document_id,
                statement_id,
                period,
                status,
                stage,
                progress = 0,
                attempts = 0,
                error_code,
                error_message,
                result_path,
                started_at,
                finished_at
            } = req.body;

            const result = await db.query(`
                INSERT INTO jobs (
                    job_type,
                    document_id,
                    statement_id,
                    period,
                    status,
                    stage,
                    progress,
                    attempts,
                    error_code,
                    error_message,
                    result_path,
                    started_at,
                    finished_at
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
                )
                RETURNING *
            `, [
                job_type,
                document_id || null,
                statement_id || null,
                period || null,
                status,
                stage || null,
                progress,
                attempts,
                error_code || null,
                error_message || null,
                result_path || null,
                started_at || null,
                finished_at || null
            ]);

            res.status(201).json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async updateJob(req, res) {
        try {
            const {
                job_type,
                document_id,
                statement_id,
                period,
                status,
                stage,
                progress,
                attempts,
                error_code,
                error_message,
                result_path,
                started_at,
                finished_at
            } = req.body;

            const result = await db.query(`
                UPDATE jobs
                SET
                    job_type = COALESCE($1, job_type),
                    document_id = COALESCE($2, document_id),
                    statement_id = COALESCE($3, statement_id),
                    period = COALESCE($4, period),
                    status = COALESCE($5, status),
                    stage = COALESCE($6, stage),
                    progress = COALESCE($7, progress),
                    attempts = COALESCE($8, attempts),
                    error_code = COALESCE($9, error_code),
                    error_message = COALESCE($10, error_message),
                    result_path = COALESCE($11, result_path),
                    started_at = COALESCE($12, started_at),
                    finished_at = COALESCE($13, finished_at)
                WHERE id = $14
                RETURNING *
            `, [
                job_type,
                document_id,
                statement_id,
                period,
                status,
                stage,
                progress,
                attempts,
                error_code,
                error_message,
                result_path,
                started_at,
                finished_at,
                req.params.jobid
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Job not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async deleteJob(req, res) {
        try {
            const result = await db.query(`
                DELETE FROM jobs
                WHERE id = $1
                RETURNING *
            `, [req.params.jobid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Job not found"
                });
            }

            res.json({
                success: true,
                job: result.rows[0]
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = {
    jobController
};