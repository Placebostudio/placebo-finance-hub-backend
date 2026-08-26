const db = require("../../db_connection");

const categoryController = {
    async getCategories(req, res) {
        try {
            const { is_active } = req.query;

            let query = `
            SELECT *
            FROM categories
            WHERE spam = FALSE
        `;

            const values = [];

            if (is_active === "true" || is_active === "false") {
                values.push(is_active === "true");

                query += `
                AND is_active = $${values.length}
            `;
            }

            query += `
            ORDER BY sort_order ASC, name ASC
        `;

            const result = await db.query(query, values);

            res.json(result.rows);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    async getCategory(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM categories
                WHERE id = $1
                  AND spam = FALSE
            `, [req.params.categoryid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Category not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    async addCategory(req, res) {
        try {
            const {
                name,
                is_vat_deductible_default = true,
                sort_order = 0,
                is_active = true,
                spam = false
            } = req.body;

            const result = await db.query(`
                INSERT INTO categories (
                    name,
                    is_vat_deductible_default,
                    sort_order,
                    is_active,
                    spam
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [
                name,
                is_vat_deductible_default,
                sort_order,
                is_active,
                spam
            ]);

            res.status(201).json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    async updateCategory(req, res) {
        try {
            const {
                name,
                is_vat_deductible_default,
                sort_order,
                is_active,
                spam
            } = req.body;

            const result = await db.query(`
            UPDATE categories
            SET
                name = COALESCE($1, name),
                is_vat_deductible_default =
                    COALESCE($2, is_vat_deductible_default),
                sort_order = COALESCE($3, sort_order),
                is_active = COALESCE($4, is_active),
                spam = COALESCE($5, spam)
            WHERE id = $6
            RETURNING *
        `, [
                name,
                is_vat_deductible_default,
                sort_order,
                is_active,
                spam !== undefined ? spam : null,
                req.params.categoryid
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Category not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    async deleteCategory(req, res) {
        try {
            const result = await db.query(`
                DELETE FROM categories
                WHERE id = $1
                RETURNING *
            `, [req.params.categoryid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Category not found"
                });
            }

            res.json({
                success: true,
                category: result.rows[0]
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = {
    categoryController
};