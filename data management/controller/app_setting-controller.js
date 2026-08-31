const db = require("../../db_connection");

const appSettingsController = {

    // ============================================================
    // CHECK OWNER PERMISSION
    // ============================================================

    async checkOwner(req, res) {

        const userId =
            req.body?.user_id ||
            req.query?.user_id ||
            req.params?.user_id;

        if (!userId) {

            res.status(401).json({
                success: false,
                error: "Unauthorized: user_id is required"
            });

            return null;
        }

        const result = await db.query(
            `
            SELECT
                id,
                role,
                is_active
            FROM users
            WHERE id = $1
            LIMIT 1
            `,
            [userId]
        );

        if (result.rows.length === 0) {

            res.status(401).json({
                success: false,
                error: "Unauthorized: user not found"
            });

            return null;
        }

        const user = result.rows[0];

        if (!user.is_active) {

            res.status(403).json({
                success: false,
                error: "Forbidden: user account is inactive"
            });

            return null;
        }

        if (user.role !== "owner") {

            res.status(403).json({
                success: false,
                error: "Forbidden: only owners can access application settings"
            });

            return null;
        }

        return user;
    },


    // ============================================================
    // GET SETTINGS
    //
    // OWNER ONLY
    // ============================================================

    async getSettings(req, res) {

        try {

            const userId =
                req.query.user_id ||
                req.body?.user_id;

            if (!userId) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: user_id is required"
                });
            }


            // ====================================================
            // CHECK OWNER
            // ====================================================

            const userResult = await db.query(
                `
                SELECT
                    id,
                    role,
                    is_active
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [userId]
            );


            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: user not found"
                });
            }


            const user = userResult.rows[0];


            if (!user.is_active) {

                return res.status(403).json({
                    success: false,
                    error: "Forbidden: user account is inactive"
                });
            }


            if (user.role !== "owner") {

                return res.status(403).json({
                    success: false,
                    error:
                        "Forbidden: only owners can access application settings"
                });
            }


            // ====================================================
            // GET SETTINGS
            // ====================================================

            const result = await db.query(
                `
                SELECT *
                FROM app_settings
                LIMIT 1
                `
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Application settings not found"
                });
            }


            return res.json({
                success: true,
                settings: result.rows[0]
            });

        } catch (err) {

            console.error(
                "Failed to get application settings:",
                err
            );

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // UPDATE SETTINGS
    //
    // OWNER ONLY
    //
    // If no settings row exists, it is created.
    // Otherwise the existing row is updated.
    // ============================================================

    async updateSettings(req, res) {

        try {

            const {
                user_id,

                company_name,
                org_number,
                vat_number,
                address,
                base_currency,
                country_code,
                reconciliation_amount_tolerance,
                reconciliation_date_window_days,
                auto_extract_on_upload,
                require_document_for_expense,
                period_lock_day,
                retention_years

            } = req.body;


            // ====================================================
            // USER REQUIRED
            // ====================================================

            if (!user_id) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: user_id is required"
                });
            }


            // ====================================================
            // CHECK OWNER
            // ====================================================

            const userResult = await db.query(
                `
                SELECT
                    id,
                    role,
                    is_active
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [user_id]
            );


            if (userResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: user not found"
                });
            }


            const user = userResult.rows[0];


            if (!user.is_active) {

                return res.status(403).json({
                    success: false,
                    error: "Forbidden: user account is inactive"
                });
            }


            if (user.role !== "owner") {

                return res.status(403).json({
                    success: false,
                    error:
                        "Forbidden: only owners can modify application settings"
                });
            }


            // ====================================================
            // CHECK EXISTING SETTINGS
            // ====================================================

            const existing = await db.query(
                `
                SELECT id
                FROM app_settings
                LIMIT 1
                `
            );


            let result;


            // ====================================================
            // CREATE SETTINGS
            // ====================================================

            if (existing.rows.length === 0) {

                result = await db.query(
                    `
                    INSERT INTO app_settings (
                        company_name,
                        org_number,
                        vat_number,
                        address,
                        base_currency,
                        country_code,
                        reconciliation_amount_tolerance,
                        reconciliation_date_window_days,
                        auto_extract_on_upload,
                        require_document_for_expense,
                        period_lock_day,
                        retention_years
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
                        $12
                    )
                    RETURNING *
                    `,
                    [
                        company_name || null,
                        org_number || null,
                        vat_number || null,
                        address || null,
                        base_currency || "SEK",
                        country_code || "SE",
                        reconciliation_amount_tolerance ?? 0.01,
                        reconciliation_date_window_days ?? 3,
                        auto_extract_on_upload ?? true,
                        require_document_for_expense ?? true,
                        period_lock_day ?? null,
                        retention_years ?? null
                    ]
                );

            }

            // ====================================================
            // UPDATE SETTINGS
            // ====================================================

            else {

                result = await db.query(
                    `
                    UPDATE app_settings
                    SET
                        company_name =
                            COALESCE($1, company_name),

                        org_number =
                            COALESCE($2, org_number),

                        vat_number =
                            COALESCE($3, vat_number),

                        address =
                            COALESCE($4, address),

                        base_currency =
                            COALESCE($5, base_currency),

                        country_code =
                            COALESCE($6, country_code),

                        reconciliation_amount_tolerance =
                            COALESCE(
                                $7,
                                reconciliation_amount_tolerance
                            ),

                        reconciliation_date_window_days =
                            COALESCE(
                                $8,
                                reconciliation_date_window_days
                            ),

                        auto_extract_on_upload =
                            COALESCE(
                                $9,
                                auto_extract_on_upload
                            ),

                        require_document_for_expense =
                            COALESCE(
                                $10,
                                require_document_for_expense
                            ),

                        period_lock_day =
                            COALESCE(
                                $11,
                                period_lock_day
                            ),

                        retention_years =
                            COALESCE(
                                $12,
                                retention_years
                            )

                    WHERE id = $13

                    RETURNING *
                    `,
                    [
                        company_name,
                        org_number,
                        vat_number,
                        address,
                        base_currency,
                        country_code,
                        reconciliation_amount_tolerance,
                        reconciliation_date_window_days,
                        auto_extract_on_upload,
                        require_document_for_expense,
                        period_lock_day,
                        retention_years,
                        existing.rows[0].id
                    ]
                );
            }


            // ====================================================
            // RESPONSE
            // ====================================================

            return res.json({
                success: true,
                settings: result.rows[0]
            });

        } catch (err) {

            console.error(
                "Failed to update application settings:",
                err
            );

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }
};


module.exports = {
    appSettingsController
};