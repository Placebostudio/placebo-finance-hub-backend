const db = require("../../db_connection");

const categoryController = {

    // ============================================================
    // GET ALL CATEGORIES
    // ============================================================

    async getCategories(req, res) {

        try {

            const userId =
                req.query.user_id ||
                req.headers["x-user-id"];

            if (!userId) {

                return res.status(401).json({
                    success: false,
                    error: "user_id is required"
                });
            }


            const userResult =
                await db.query(
                    `
                    SELECT role
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [userId]
                );


            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const role =
                userResult.rows[0].role;


            if (
                role !== "viewer" &&
                role !== "manager" &&
                role !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            const {
                is_active,
                spam
            } = req.query;


            let query = `
                SELECT *
                FROM categories
                WHERE 1 = 1
            `;

            const values = [];


            if (
                is_active === "true" ||
                is_active === "false"
            ) {

                values.push(
                    is_active === "true"
                );

                query += `
                    AND is_active = $${values.length}
                `;
            }


            if (
                spam === "true" ||
                spam === "false"
            ) {

                values.push(
                    spam === "true"
                );

                query += `
                    AND spam = $${values.length}
                `;
            }


            query += `
                ORDER BY sort_order ASC, name ASC
            `;


            const result =
                await db.query(
                    query,
                    values
                );


            return res.json(
                result.rows
            );

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // GET ONE CATEGORY
    // ============================================================

    async getCategory(req, res) {

        try {

            const userId =
                req.query.user_id ||
                req.headers["x-user-id"];

            if (!userId) {

                return res.status(401).json({
                    success: false,
                    error: "user_id is required"
                });
            }


            const userResult =
                await db.query(
                    `
                    SELECT role
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [userId]
                );


            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const role =
                userResult.rows[0].role;


            if (
                role !== "viewer" &&
                role !== "manager" &&
                role !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            const result =
                await db.query(
                    `
                    SELECT *
                    FROM categories
                    WHERE id = $1
                      AND spam = FALSE
                    `,
                    [
                        req.params.categoryid
                    ]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Category not found"
                });
            }


            return res.json(
                result.rows[0]
            );

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // ADD CATEGORY
    // ============================================================
    //
    // MANAGER + OWNER
    // ============================================================

    async addCategory(req, res) {

        try {

            const {
                name,
                is_vat_deductible_default = true,
                sort_order = 0,
                is_active = true,
                spam = false,
                user_id
            } = req.body;


            if (!user_id) {

                return res.status(401).json({
                    success: false,
                    error: "user_id is required"
                });
            }


            const userResult =
                await db.query(
                    `
                    SELECT role
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [user_id]
                );


            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const role =
                userResult.rows[0].role;


            if (
                role !== "manager" &&
                role !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            const result =
                await db.query(
                    `
                    INSERT INTO categories (
                        name,
                        is_vat_deductible_default,
                        sort_order,
                        is_active,
                        spam
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5
                    )
                    RETURNING *
                    `,
                    [
                        name,
                        is_vat_deductible_default,
                        sort_order,
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
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // UPDATE CATEGORY
    // ============================================================
    //
    // MANAGER + OWNER
    //
    // spam: true = SOFT DELETE
    // ============================================================

    async updateCategory(req, res) {

        try {

            const {
                name,
                is_vat_deductible_default,
                sort_order,
                is_active,
                spam,
                user_id
            } = req.body;


            if (!user_id) {

                return res.status(401).json({
                    success: false,
                    error: "user_id is required"
                });
            }


            const userResult =
                await db.query(
                    `
                    SELECT role
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [user_id]
                );


            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const role =
                userResult.rows[0].role;


            if (
                role !== "manager" &&
                role !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            const result =
                await db.query(
                    `
                    UPDATE categories
                    SET
                        name =
                            COALESCE(
                                $1,
                                name
                            ),

                        is_vat_deductible_default =
                            COALESCE(
                                $2,
                                is_vat_deductible_default
                            ),

                        sort_order =
                            COALESCE(
                                $3,
                                sort_order
                            ),

                        is_active =
                            COALESCE(
                                $4,
                                is_active
                            ),

                        spam =
                            COALESCE(
                                $5,
                                spam
                            )

                    WHERE id = $6

                    RETURNING *
                    `,
                    [
                        name ?? null,
                        is_vat_deductible_default ?? null,
                        sort_order ?? null,
                        is_active ?? null,
                        spam !== undefined
                            ? spam
                            : null,
                        req.params.categoryid
                    ]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Category not found"
                });
            }


            return res.json(
                result.rows[0]
            );

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // DELETE CATEGORY
    // ============================================================
    //
    // OWNER ONLY
    //
    // REAL DATABASE DELETE
    // ============================================================

    async deleteCategory(req, res) {

        try {

            const {
                user_id
            } = req.body;


            if (!user_id) {

                return res.status(401).json({
                    success: false,
                    error: "user_id is required"
                });
            }


            const userResult =
                await db.query(
                    `
                    SELECT role
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [user_id]
                );


            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const role =
                userResult.rows[0].role;


            if (role !== "owner") {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            const result =
                await db.query(
                    `
                    DELETE FROM categories
                    WHERE id = $1
                    RETURNING *
                    `,
                    [
                        req.params.categoryid
                    ]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Category not found"
                });
            }


            return res.json({

                success: true,

                category:
                    result.rows[0]

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
    categoryController
};