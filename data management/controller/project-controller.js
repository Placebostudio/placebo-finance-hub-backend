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

            if (spam !== undefined) {

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

            res.json(result.rows);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: err.message
            });
        }
    },


    // ============================================================
    // GET ONE PROJECT
    // ============================================================

    async getProject(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM projects
                WHERE id = $1
            `, [req.params.projectid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Project not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    // ============================================================
    // CREATE PROJECT
    // ============================================================

    async addProject(req, res) {
        try {
            const {
                name,
                code,
                status = "active",
                start_date,
                end_date,
                notes,
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
                INSERT INTO projects (
                    name,
                    code,
                    status,
                    start_date,
                    end_date,
                    notes,
                    spam
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                name,
                code,
                status,
                start_date || null,
                end_date || null,
                notes || null,
                spam
            ]);

            res.status(201).json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    // ============================================================
    // UPDATE PROJECT
    //
    // Can update:
    // - all normal fields
    // - only spam
    // - normal fields + spam
    // ============================================================

    async updateProject(req, res) {
        try {
            const {
                name,
                code,
                status,
                start_date,
                end_date,
                notes,
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
                UPDATE projects
                SET
                    name = COALESCE($1, name),
                    code = COALESCE($2, code),
                    status = COALESCE($3, status),
                    start_date = COALESCE($4, start_date),
                    end_date = COALESCE($5, end_date),
                    notes = COALESCE($6, notes),
                    spam = COALESCE($7, spam)
                WHERE id = $8
                RETURNING *
            `, [
                name ?? null,
                code ?? null,
                status ?? null,
                start_date ?? null,
                end_date ?? null,
                notes ?? null,
                spam !== undefined ? spam : null,
                req.params.projectid
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Project not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    // ============================================================
    // DELETE PROJECT
    // ============================================================

    async deleteProject(req, res) {
        try {
            const result = await db.query(`
                DELETE FROM projects
                WHERE id = $1
                RETURNING *
            `, [req.params.projectid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Project not found"
                });
            }

            res.json({
                success: true,
                project: result.rows[0]
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = {
    projectController
};