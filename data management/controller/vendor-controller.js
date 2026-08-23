const db = require("../../db_connection");

const vendorController = {

    async getVendors(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM vendors
                ORDER BY name ASC
            `);

            res.json(result.rows);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async getVendor(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM vendors
                WHERE id = $1
            `, [req.params.vendorid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Vendor not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async addVendor(req, res) {
        try {
            const {
                name,
                normalized_name,
                aliases = [],
                default_category_id,
                default_vat_rate,
                country_code,
                vat_number,
                is_active = true
            } = req.body;

            const result = await db.query(`
                INSERT INTO vendors (
                    name,
                    normalized_name,
                    aliases,
                    default_category_id,
                    default_vat_rate,
                    country_code,
                    vat_number,
                    is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                name,
                normalized_name,
                JSON.stringify(aliases),
                default_category_id || null,
                default_vat_rate ?? null,
                country_code || null,
                vat_number || null,
                is_active
            ]);

            res.status(201).json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async updateVendor(req, res) {
        try {
            const {
                name,
                normalized_name,
                aliases,
                default_category_id,
                default_vat_rate,
                country_code,
                vat_number,
                is_active
            } = req.body;

            const result = await db.query(`
                UPDATE vendors
                SET
                    name = COALESCE($1, name),
                    normalized_name = COALESCE($2, normalized_name),
                    aliases = COALESCE($3, aliases),
                    default_category_id = COALESCE($4, default_category_id),
                    default_vat_rate = COALESCE($5, default_vat_rate),
                    country_code = COALESCE($6, country_code),
                    vat_number = COALESCE($7, vat_number),
                    is_active = COALESCE($8, is_active)
                WHERE id = $9
                RETURNING *
            `, [
                name,
                normalized_name,
                aliases !== undefined ? JSON.stringify(aliases) : null,
                default_category_id,
                default_vat_rate,
                country_code,
                vat_number,
                is_active,
                req.params.vendorid
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Vendor not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async deleteVendor(req, res) {
        try {
            const result = await db.query(`
                DELETE FROM vendors
                WHERE id = $1
                RETURNING *
            `, [req.params.vendorid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Vendor not found"
                });
            }

            res.json({
                success: true,
                vendor: result.rows[0]
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = {
    vendorController
};