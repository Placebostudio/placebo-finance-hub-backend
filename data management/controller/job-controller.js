const db = require("../../db_connection");

const jobController = {

    // ============================================================
    // GET ALL JOBS
    // ============================================================

    async getJobs(req, res) {

        try {

            const result = await db.query(`
                SELECT
                    *,
                    spam
                FROM jobs
                ORDER BY started_at DESC NULLS LAST
            `);

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
    // GET ONE JOB
    // ============================================================

    async getJob(req, res) {

        try {

            const result = await db.query(
                `
                SELECT
                    *,
                    spam
                FROM jobs
                WHERE id = $1
                `,
                [req.params.jobid]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Job not found"
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
    // CREATE JOB
    // ============================================================

    async addJob(req, res) {

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
            finished_at,
            spam = false,
            user_id
        } = req.body;


        try {

            // ====================================================
            // CHECK USER + PERMISSION
            // ====================================================

            const permissionResult = await db.query(
                `
                SELECT role
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [user_id]
            );

            if (permissionResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }

            const userRole =
                permissionResult.rows[0].role;

            if (
                userRole !== "manager" &&
                userRole !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ====================================================
            // REQUIRED FIELDS
            // ====================================================

            if (
                !job_type ||
                !status
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "job_type and status are required"
                });
            }


            // ====================================================
            // VALIDATE SPAM
            // ====================================================

            if (typeof spam !== "boolean") {

                return res.status(400).json({
                    success: false,
                    error: "spam must be true or false"
                });
            }


            // ====================================================
            // VALIDATE PROGRESS
            // ====================================================

            if (
                !Number.isFinite(Number(progress)) ||
                Number(progress) < 0 ||
                Number(progress) > 100
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "progress must be a number between 0 and 100"
                });
            }


            // ====================================================
            // VALIDATE ATTEMPTS
            // ====================================================

            if (
                !Number.isInteger(Number(attempts)) ||
                Number(attempts) < 0
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "attempts must be a non-negative integer"
                });
            }


            // ====================================================
            // INSERT
            // ====================================================

            const result = await db.query(
                `
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
                    finished_at,
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
                    $12,
                    $13,
                    $14
                )
                RETURNING *
                `,
                [
                    job_type,
                    document_id || null,
                    statement_id || null,
                    period || null,
                    status,
                    stage || null,
                    Number(progress),
                    Number(attempts),
                    error_code || null,
                    error_message || null,
                    result_path || null,
                    started_at || null,
                    finished_at || null,
                    spam
                ]
            );

            return res.status(201).json({
                success: true,
                job: result.rows[0]
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
    // UPDATE JOB
    // ============================================================

    async updateJob(req, res) {

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
            finished_at,
            spam,
            user_id
        } = req.body;


        try {

            // ====================================================
            // CHECK USER + PERMISSION
            // ====================================================

            const permissionResult = await db.query(
                `
                SELECT role
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [user_id]
            );

            if (permissionResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }

            const userRole =
                permissionResult.rows[0].role;

            if (
                userRole !== "manager" &&
                userRole !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ====================================================
            // CHECK JOB EXISTS
            // ====================================================

            const existing = await db.query(
                `
                SELECT id
                FROM jobs
                WHERE id = $1
                `,
                [req.params.jobid]
            );

            if (existing.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Job not found"
                });
            }


            // ====================================================
            // VALIDATE SPAM
            // ====================================================

            if (
                spam !== undefined &&
                typeof spam !== "boolean"
            ) {

                return res.status(400).json({
                    success: false,
                    error: "spam must be true or false"
                });
            }


            // ====================================================
            // VALIDATE PROGRESS
            // ====================================================

            if (
                progress !== undefined &&
                (
                    !Number.isFinite(Number(progress)) ||
                    Number(progress) < 0 ||
                    Number(progress) > 100
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "progress must be a number between 0 and 100"
                });
            }


            // ====================================================
            // VALIDATE ATTEMPTS
            // ====================================================

            if (
                attempts !== undefined &&
                (
                    !Number.isInteger(Number(attempts)) ||
                    Number(attempts) < 0
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "attempts must be a non-negative integer"
                });
            }


            // ====================================================
            // UPDATE
            // ====================================================

            const result = await db.query(
                `
                UPDATE jobs
                SET
                    job_type =
                        COALESCE($1, job_type),

                    document_id =
                        COALESCE($2, document_id),

                    statement_id =
                        COALESCE($3, statement_id),

                    period =
                        COALESCE($4, period),

                    status =
                        COALESCE($5, status),

                    stage =
                        COALESCE($6, stage),

                    progress =
                        COALESCE($7, progress),

                    attempts =
                        COALESCE($8, attempts),

                    error_code =
                        COALESCE($9, error_code),

                    error_message =
                        COALESCE($10, error_message),

                    result_path =
                        COALESCE($11, result_path),

                    started_at =
                        COALESCE($12, started_at),

                    finished_at =
                        COALESCE($13, finished_at),

                    spam =
                        COALESCE($14, spam)

                WHERE id = $15

                RETURNING *
                `,
                [
                    job_type ?? null,
                    document_id ?? null,
                    statement_id ?? null,
                    period ?? null,
                    status ?? null,
                    stage ?? null,
                    progress !== undefined
                        ? Number(progress)
                        : null,
                    attempts !== undefined
                        ? Number(attempts)
                        : null,
                    error_code ?? null,
                    error_message ?? null,
                    result_path ?? null,
                    started_at ?? null,
                    finished_at ?? null,
                    spam !== undefined
                        ? spam
                        : null,
                    req.params.jobid
                ]
            );

            return res.json({
                success: true,
                job: result.rows[0]
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
    // DELETE JOB
    // ============================================================

    async deleteJob(req, res) {

        const { user_id } = req.body;


        try {

            // ====================================================
            // CHECK USER + PERMISSION
            // ====================================================

            const permissionResult = await db.query(
                `
                SELECT role
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [user_id]
            );

            if (permissionResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }

            const userRole =
                permissionResult.rows[0].role;

            if (
                userRole !== "manager" &&
                userRole !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ====================================================
            // DELETE
            // ====================================================

            const result = await db.query(
                `
                DELETE FROM jobs
                WHERE id = $1
                RETURNING *
                `,
                [req.params.jobid]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Job not found"
                });
            }

            return res.json({
                success: true,
                job: result.rows[0]
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

module.exports = {
    jobController
};