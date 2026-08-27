const db = require("../../db_connection");

const vendorController = {

    // ============================================================
    // GET ALL VENDORS
    // ============================================================

    async getVendors(req, res) {

        try {

            const {
                spam,
                is_active
            } = req.query;

            const conditions = [];
            const values = [];

            if (spam === "true" || spam === "false") {

                values.push(
                    spam === "true"
                );

                conditions.push(
                    `spam = $${values.length}`
                );
            }

            if (is_active === "true" || is_active === "false") {

                values.push(
                    is_active === "true"
                );

                conditions.push(
                    `is_active = $${values.length}`
                );
            }

            const whereClause =
                conditions.length > 0
                    ? `WHERE ${conditions.join(" AND ")}`
                    : "";

            const result = await db.query(
                `
            SELECT *
            FROM vendors
            ${whereClause}
            ORDER BY name ASC
            `,
                values
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
    // GET ONE VENDOR
    // ============================================================

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

            res.status(500).json({
                error: err.message
            });
        }
    },


    // ============================================================
    // ADD VENDOR
    // ============================================================

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
                is_active = true,
                spam = false
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
                    is_active,
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
                    $9
                )
                RETURNING *
            `, [
                name,
                normalized_name ?? null,
                JSON.stringify(aliases),
                default_category_id || null,
                default_vat_rate ?? null,
                country_code || null,
                vat_number || null,
                is_active,
                spam
            ]);


            res.status(201).json(result.rows[0]);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: err.message
            });
        }
    },


    // ============================================================
    // UPDATE VENDOR
    //
    // Can update:
    // - all normal fields
    // - ONLY spam
    //
    // Examples:
    //
    // { "spam": true }
    //
    // or
    //
    // {
    //   "name": "Example",
    //   "is_active": true
    // }
    // ============================================================

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
                is_active,
                spam
            } = req.body;


            // ========================================================
            // UPDATE
            // ========================================================

            const result = await db.query(`
                UPDATE vendors
                SET
                    name =
                        COALESCE($1, name),

                    normalized_name =
                        COALESCE($2, normalized_name),

                    aliases =
                        COALESCE($3, aliases),

                    default_category_id =
                        COALESCE($4, default_category_id),

                    default_vat_rate =
                        COALESCE($5, default_vat_rate),

                    country_code =
                        COALESCE($6, country_code),

                    vat_number =
                        COALESCE($7, vat_number),

                    is_active =
                        COALESCE($8, is_active),

                    spam =
                        COALESCE($9, spam)

                WHERE id = $10

                RETURNING *
            `, [
                name ?? null,
                normalized_name ?? null,
                aliases !== undefined
                    ? JSON.stringify(aliases)
                    : null,
                default_category_id ?? null,
                default_vat_rate ?? null,
                country_code ?? null,
                vat_number ?? null,
                is_active ?? null,
                spam ?? null,
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

            res.status(500).json({
                error: err.message
            });
        }
    },


    // ============================================================
    // DELETE VENDOR
    //
    // HARD DELETE
    // ============================================================

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

            res.status(500).json({
                error: err.message
            });
        }
    }
};


module.exports = {
    vendorController
};