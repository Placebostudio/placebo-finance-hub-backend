const db = require("../../db_connection");

const columnMappingController = {

    async getColumnMappings(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM column_mappings
                WHERE spam = FALSE
                ORDER BY created_at DESC
            `);

            res.json(result.rows);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async getColumnMapping(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM column_mappings
                WHERE id = $1
                  AND spam = FALSE
            `, [req.params.column_mappingid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Column mapping not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async addColumnMapping(req, res) {
        try {
            const {
                name,
                statement_type,
                source_signature,
                mapping,
                spam
            } = req.body;

            const result = await db.query(`
                INSERT INTO column_mappings (
                    name,
                    statement_type,
                    source_signature,
                    mapping,
                    spam
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [
                name,
                statement_type,
                source_signature,
                JSON.stringify(mapping),
                spam ?? false
            ]);

            res.status(201).json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async updateColumnMapping(req, res) {
        try {
            const {
                name,
                statement_type,
                source_signature,
                mapping,
                spam
            } = req.body;

            const result = await db.query(`
            UPDATE column_mappings
            SET
                name = COALESCE($1, name),
                statement_type = COALESCE($2, statement_type),
                source_signature = COALESCE($3, source_signature),
                mapping = COALESCE($4, mapping),
                spam = COALESCE($5, spam)
            WHERE id = $6
            RETURNING *
        `, [
                name,
                statement_type,
                source_signature,
                mapping !== undefined ? JSON.stringify(mapping) : null,
                spam !== undefined ? spam : null,
                req.params.column_mappingid
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Column mapping not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async deleteColumnMapping(req, res) {
        try {
            const result = await db.query(`
                DELETE FROM column_mappings
                WHERE id = $1
                RETURNING *
            `, [req.params.column_mappingid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Column mapping not found"
                });
            }

            res.json({
                success: true,
                columnMapping: result.rows[0]
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = {
    columnMappingController
};