const db = require("../../db_connection");

exports.currencyController = {
    async getCurrencies(req, res) {
        try {
            const response = await fetch(
                "https://api.frankfurter.dev/v2/rates?base=EUR&quotes=EUR,SEK,USD,GBP"
            );

            if (!response.ok) {
                throw new Error("Failed to retrieve currency rates");
            }

            const rates = await response.json();

            res.json(rates);
        } catch (err) {
            console.error("Currency API Error:", err);

            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }, async getCurrency(req, res) {
        const db = require("../../db_connection");

        const { currency } = req.params;

        try {
            const result = await db.query(
                `SELECT
                id,
                currency,
                compared_to_base_currency,
                rate,
                last_updated
             FROM currency_rates
             WHERE UPPER(currency) = UPPER($1)
             LIMIT 1`,
                [currency]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: "Currency not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);

            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }, async updateCurrencies(req, res) {
        const db = require("../../db_connection");

        try {
            const response = await fetch(
                "https://api.frankfurter.dev/v2/rates?base=EUR"
            );

            if (!response.ok) {
                throw new Error("Failed to retrieve currency rates");
            }

            const rates = await response.json();

            for (const item of rates) {
                await db.query(
                    `INSERT INTO currency_rates (
                    currency,
                    compared_to_base_currency,
                    rate,
                    last_updated
                )
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (currency, compared_to_base_currency)
                DO UPDATE SET
                    rate = EXCLUDED.rate,
                    last_updated = NOW()`,
                    [
                        item.quote,
                        item.base,
                        item.rate
                    ]
                );
            }

            const result = await db.query(`
            SELECT
                id,
                currency,
                compared_to_base_currency,
                rate,
                last_updated
            FROM currency_rates
            ORDER BY currency
        `);

            res.json({
                success: true,
                updated: true,
                rates: result.rows
            });

        } catch (err) {
            console.error(err);

            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }, async deleteCurrency(req, res) {
        const db = require("../../db_connection");

        const { currency } = req.params;

        try {
            const result = await db.query(
                `DELETE FROM currency_rates
             WHERE UPPER(currency) = UPPER($1)
             RETURNING *`,
                [currency]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: "Currency not found"
                });
            }

            res.json({
                success: true,
                deletedCurrency: result.rows[0]
            });

        } catch (err) {
            console.error(err);

            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }, async retrieveCurrencyData(req, res) {
        try {
            const response = await fetch(
                "https://api.frankfurter.dev/v2/rates?base=EUR"
            );

            if (!response.ok) {
                return res.status(response.status).json({
                    success: false,
                    error: "Failed to retrieve currency data"
                });
            }

            const rates = await response.json();

            res.json({
                success: true,
                rates
            });

        } catch (err) {
            console.error("Currency API Error:", err);

            res.status(500).json({
                success: false,
                error: "Failed to retrieve currency data"
            });
        }
    }
}