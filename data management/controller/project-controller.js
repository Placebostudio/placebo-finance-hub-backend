const db = require("../../db_connection");

const projectController = {

    // ============================================================
    // GET ALL PROJECTS
    // ============================================================

    async getProjects(req, res) {

        try {

            const { spam } = req.query;

            let query = `
            SELECT *
            FROM projects
            WHERE 1 = 1
        `;

            const params = [];

            if (spam === "true" || spam === "false") {

                params.push(
                    spam === "true"
                );

                query += `
                AND spam = $${params.length}
            `;
            }

            query += `
            ORDER BY name ASC
        `;

            const result = await db.query(
                query,
                params
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
    // GET ONE PROJECT
    // ============================================================

    async getProject(req, res) {

        try {

            const result = await db.query(
                `
                SELECT *
                FROM projects
                WHERE id = $1
                `,
                [req.params.projectid]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Project not found"
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
    // CREATE PROJECT
    // ============================================================

    async addProject(req, res) {

        const {
            name,
            code,
            status = "active",
            start_date,
            end_date,
            notes,
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
            // VALIDATE REQUIRED FIELDS
            // ====================================================

            if (!name || !code) {

                return res.status(400).json({
                    success: false,
                    error: "name and code are required"
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
            // INSERT
            // ====================================================

            const result = await db.query(
                `
                INSERT INTO projects (
                    name,
                    code,
                    status,
                    start_date,
                    end_date,
                    notes,
                    spam
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )
                RETURNING *
                `,
                [
                    name,
                    code,
                    status,
                    start_date || null,
                    end_date || null,
                    notes || null,
                    spam
                ]
            );

            return res.status(201).json({
                success: true,
                project: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            if (err.code === "23505") {

                return res.status(409).json({
                    success: false,
                    error: "A project with this name or code already exists"
                });
            }

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // UPDATE PROJECT
    // ============================================================

    async updateProject(req, res) {

        const {
            name,
            code,
            status,
            start_date,
            end_date,
            notes,
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
            // CHECK PROJECT EXISTS
            // ====================================================

            const existing = await db.query(
                `
                SELECT id
                FROM projects
                WHERE id = $1
                `,
                [req.params.projectid]
            );

            if (existing.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Project not found"
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
            // UPDATE
            // ====================================================

            const result = await db.query(
                `
                UPDATE projects
                SET
                    name =
                        COALESCE($1, name),

                    code =
                        COALESCE($2, code),

                    status =
                        COALESCE($3, status),

                    start_date =
                        COALESCE($4, start_date),

                    end_date =
                        COALESCE($5, end_date),

                    notes =
                        COALESCE($6, notes),

                    spam =
                        COALESCE($7, spam)

                WHERE id = $8

                RETURNING *
                `,
                [
                    name ?? null,
                    code ?? null,
                    status ?? null,
                    start_date ?? null,
                    end_date ?? null,
                    notes ?? null,
                    spam !== undefined
                        ? spam
                        : null,
                    req.params.projectid
                ]
            );

            return res.json({
                success: true,
                project: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            if (err.code === "23505") {

                return res.status(409).json({
                    success: false,
                    error: "A project with this name or code already exists"
                });
            }

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // DELETE PROJECT
    // ============================================================

    async deleteProject(req, res) {

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
                DELETE FROM projects
                WHERE id = $1
                RETURNING *
                `,
                [req.params.projectid]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Project not found"
                });
            }

            return res.json({
                success: true,
                project: result.rows[0]
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
    projectController
};