const db = require("../../db_connection");

const vendorController = {

    // ============================================================
    // GET ALL VENDORS
    // ============================================================

    async getVendors(req, res) {

        try {

            const {
                spam,
                is_active,
                user_id
            } = req.query;


            // ========================================================
            // CHECK USER
            // ========================================================

            if (!user_id) {

                return res.status(401).json({
                    error: "user_id is required"
                });
            }

            const userResult = await db.query(
                `
                SELECT id, role
                FROM users
                WHERE id = $1
                `,
                [user_id]
            );

            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    error: "User not found"
                });
            }


            // ========================================================
            // GET VENDORS
            // ========================================================

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


            return res.json(result.rows);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                error: err.message
            });
        }
    },


    // ============================================================
    // GET ONE VENDOR
    // ============================================================

    async getVendor(req, res) {

        try {

            const {
                user_id
            } = req.query;


            // ========================================================
            // CHECK USER
            // ========================================================

            if (!user_id) {

                return res.status(401).json({
                    error: "user_id is required"
                });
            }

            const userResult = await db.query(
                `
                SELECT id, role
                FROM users
                WHERE id = $1
                `,
                [user_id]
            );

            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    error: "User not found"
                });
            }


            // ========================================================
            // GET VENDOR
            // ========================================================

            const result = await db.query(
                `
                SELECT *
                FROM vendors
                WHERE id = $1
                `,
                [req.params.vendorid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    error: "Vendor not found"
                });
            }


            return res.json(result.rows[0]);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                error: err.message
            });
        }
    },


    // ============================================================
    // ADD VENDOR
    //
    // VIEWER  -> NO
    // MANAGER -> YES
    // OWNER   -> YES
    // ============================================================

    async addVendor(req, res) {

        try {

            const {
                user_id,
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


            // ========================================================
            // CHECK USER
            // ========================================================

            if (!user_id) {

                return res.status(401).json({
                    error: "user_id is required"
                });
            }

            const userResult = await db.query(
                `
                SELECT id, role
                FROM users
                WHERE id = $1
                `,
                [user_id]
            );

            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    error: "User not found"
                });
            }


            const user = userResult.rows[0];


            // ========================================================
            // CHECK PERMISSION
            // ========================================================

            if (
                user.role !== "manager" &&
                user.role !== "owner"
            ) {

                return res.status(403).json({
                    error:
                        "You do not have permission to create vendors"
                });
            }


            // ========================================================
            // CREATE
            // ========================================================

            const result = await db.query(
                `
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
                `,
                [
                    name,
                    normalized_name ?? null,
                    JSON.stringify(aliases),
                    default_category_id || null,
                    default_vat_rate ?? null,
                    country_code || null,
                    vat_number || null,
                    is_active,
                    spam
                ]
            );


            return res.status(201).json(
                result.rows[0]
            );

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                error: err.message
            });
        }
    },


    // ============================================================
    // UPDATE VENDOR
    //
    // VIEWER  -> NO
    // MANAGER -> YES
    // OWNER   -> YES
    //
    // This also allows the manager to perform SOFT DELETE
    // by setting:
    //
    // {
    //     "spam": true
    // }
    // ============================================================

    async updateVendor(req, res) {

        try {

            const {
                user_id,
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
            // CHECK USER
            // ========================================================

            if (!user_id) {

                return res.status(401).json({
                    error: "user_id is required"
                });
            }

            const userResult = await db.query(
                `
                SELECT id, role
                FROM users
                WHERE id = $1
                `,
                [user_id]
            );

            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    error: "User not found"
                });
            }


            const user = userResult.rows[0];


            // ========================================================
            // CHECK PERMISSION
            // ========================================================

            if (
                user.role !== "manager" &&
                user.role !== "owner"
            ) {

                return res.status(403).json({
                    error:
                        "You do not have permission to update vendors"
                });
            }


            // ========================================================
            // UPDATE
            // ========================================================

            const result = await db.query(
                `
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
                `,
                [
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
                ]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    error: "Vendor not found"
                });
            }


            return res.json(
                result.rows[0]
            );

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                error: err.message
            });
        }
    },


    // ============================================================
    // SOFT DELETE VENDOR
    //
    // VIEWER  -> NO
    // MANAGER -> YES
    // OWNER   -> YES
    //
    // Sets spam = true.
    // ============================================================

    async softDeleteVendor(req, res) {

        try {

            const {
                user_id
            } = req.body;


            // ========================================================
            // CHECK USER
            // ========================================================

            if (!user_id) {

                return res.status(401).json({
                    error: "user_id is required"
                });
            }

            const userResult = await db.query(
                `
                SELECT id, role
                FROM users
                WHERE id = $1
                `,
                [user_id]
            );

            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    error: "User not found"
                });
            }


            const user = userResult.rows[0];


            // ========================================================
            // CHECK PERMISSION
            // ========================================================

            if (
                user.role !== "manager" &&
                user.role !== "owner"
            ) {

                return res.status(403).json({
                    error:
                        "You do not have permission to delete vendors"
                });
            }


            // ========================================================
            // SOFT DELETE
            // ========================================================

            const result = await db.query(
                `
                UPDATE vendors
                SET spam = true
                WHERE id = $1
                RETURNING *
                `,
                [req.params.vendorid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    error: "Vendor not found"
                });
            }


            return res.json({
                success: true,
                vendor: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                error: err.message
            });
        }
    },


    // ============================================================
    // HARD DELETE VENDOR
    //
    // VIEWER  -> NO
    // MANAGER -> NO
    // OWNER   -> YES
    // ============================================================

    async deleteVendor(req, res) {

        try {

            const {
                user_id
            } = req.body;


            // ========================================================
            // CHECK USER
            // ========================================================

            if (!user_id) {

                return res.status(401).json({
                    error: "user_id is required"
                });
            }

            const userResult = await db.query(
                `
                SELECT id, role
                FROM users
                WHERE id = $1
                `,
                [user_id]
            );

            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    error: "User not found"
                });
            }


            const user = userResult.rows[0];


            // ========================================================
            // ONLY OWNER
            // ========================================================

            if (user.role !== "owner") {

                return res.status(403).json({
                    error:
                        "Only the owner can permanently delete vendors"
                });
            }


            // ========================================================
            // HARD DELETE
            // ========================================================

            const result = await db.query(
                `
                DELETE FROM vendors
                WHERE id = $1
                RETURNING *
                `,
                [req.params.vendorid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    error: "Vendor not found"
                });
            }


            return res.json({
                success: true,
                vendor: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                error: err.message
            });
        }
    }
};


module.exports = {
    vendorController
};