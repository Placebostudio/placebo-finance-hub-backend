const db = require("../../db_connection");

const appSettingsController = {

    async getSettings(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM app_settings
                LIMIT 1
            `);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Application settings not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    async updateSettings(req, res) {
        try {
            const {
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

            const existing = await db.query(`
                SELECT id
                FROM app_settings
                LIMIT 1
            `);

            let result;

            if (existing.rows.length === 0) {

                result = await db.query(`
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
                        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
                    )
                    RETURNING *
                `, [
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
                ]);

            } else {

                result = await db.query(`
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
                            COALESCE($7, reconciliation_amount_tolerance),
                        reconciliation_date_window_days =
                            COALESCE($8, reconciliation_date_window_days),
                        auto_extract_on_upload =
                            COALESCE($9, auto_extract_on_upload),
                        require_document_for_expense =
                            COALESCE($10, require_document_for_expense),
                        period_lock_day =
                            COALESCE($11, period_lock_day),
                        retention_years =
                            COALESCE($12, retention_years)
                    WHERE id = $13
                    RETURNING *
                `, [
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
                ]);
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = {
    appSettingsController
};