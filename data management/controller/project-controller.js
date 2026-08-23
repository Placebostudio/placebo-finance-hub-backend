const db = require("../../db_connection");

const projectController = {

    async getProjects(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM projects
                ORDER BY name ASC
            `);

            res.json(result.rows);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


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


    async addProject(req, res) {
        try {
            const {
                name,
                code,
                status = "active",
                start_date,
                end_date,
                notes
            } = req.body;

            const result = await db.query(`
                INSERT INTO projects (
                    name,
                    code,
                    status,
                    start_date,
                    end_date,
                    notes
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [
                name,
                code,
                status,
                start_date || null,
                end_date || null,
                notes || null
            ]);

            res.status(201).json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async updateProject(req, res) {
        try {
            const {
                name,
                code,
                status,
                start_date,
                end_date,
                notes
            } = req.body;

            const result = await db.query(`
                UPDATE projects
                SET
                    name = COALESCE($1, name),
                    code = COALESCE($2, code),
                    status = COALESCE($3, status),
                    start_date = COALESCE($4, start_date),
                    end_date = COALESCE($5, end_date),
                    notes = COALESCE($6, notes)
                WHERE id = $7
                RETURNING *
            `, [
                name,
                code,
                status,
                start_date,
                end_date,
                notes,
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