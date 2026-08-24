const db = require("../../db_connection");


const VALID_STATUSES = [
    "unmatched",
    "matched",
    "ignored",
    "awaiting_receipt"
];

const VALID_COVERAGE_STATES = [
    "unmatched",
    "partially_matched",
    "fully_matched"
];


const transactionController = {

    // ============================================================
    // GET ALL TRANSACTIONS
    // ============================================================

    async getTransactions(req, res) {

        try {

            const result = await db.query(
                `SELECT *
                 FROM transactions
                 ORDER BY transaction_date DESC, line_no ASC`
            );

            return res.json(result.rows);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // GET ONE TRANSACTION
    // ============================================================

    async getTransaction(req, res) {

        const { transactionid } = req.params;

        try {

            const result = await db.query(
                `SELECT *
                 FROM transactions
                 WHERE id = $1`,
                [transactionid]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Transaction not found"
                });
            }

            return res.json(result.rows[0]);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // GET TRANSACTIONS FOR A STATEMENT
    // ============================================================

    async getTransactionsByStatement(req, res) {

        const { statementid } = req.params;

        try {

            const result = await db.query(
                `SELECT *
                 FROM transactions
                 WHERE statement_id = $1
                 ORDER BY line_no ASC, transaction_date ASC`,
                [statementid]
            );

            return res.json(result.rows);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // ADD TRANSACTION
    // ============================================================

    async addTransaction(req, res) {

        const {
            statement_id,
            statement_period,
            line_no,
            transaction_date,
            posting_date,
            description,
            normalized_description,
            counterparty_ref,
            original_amount,
            original_currency,
            statement_fx_rate,
            billed_amount,
            billed_currency = "SEK",
            status = "unmatched",
            coverage_state = "unmatched",
            ignore_reason,
            row_hash,
            spam = false
        } = req.body;


        try {

            // ====================================================
            // REQUIRED FIELDS
            // ====================================================

            if (
                !statement_id ||
                !statement_period ||
                !transaction_date ||
                !description ||
                !normalized_description ||
                billed_amount === undefined ||
                billed_amount === null ||
                !row_hash
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "statement_id, statement_period, " +
                        "transaction_date, description, " +
                        "normalized_description, billed_amount " +
                        "and row_hash are required"
                });
            }


            // ====================================================
            // VALIDATE STATUS
            // ====================================================

            if (!VALID_STATUSES.includes(status)) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid status. Allowed values: " +
                        VALID_STATUSES.join(", ")
                });
            }


            // ====================================================
            // VALIDATE COVERAGE STATE
            // ====================================================

            if (!VALID_COVERAGE_STATES.includes(coverage_state)) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid coverage_state. Allowed values: " +
                        VALID_COVERAGE_STATES.join(", ")
                });
            }


            // ====================================================
            // VALIDATE SPAM
            // ====================================================

            if (typeof spam !== "boolean") {

                return res.status(400).json({
                    success: false,
                    error: "spam must be true or false"
                });
            }


            // ====================================================
            // IGNORED TRANSACTION MUST HAVE A REASON
            // ====================================================

            if (
                status === "ignored" &&
                !ignore_reason
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "ignore_reason is required when status is ignored"
                });
            }


            // ====================================================
            // CHECK STATEMENT EXISTS
            // ====================================================

            const statement = await db.query(
                `SELECT id, period
                 FROM statements
                 WHERE id = $1`,
                [statement_id]
            );

            if (statement.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Statement not found"
                });
            }


            // ====================================================
            // INSERT
            // ====================================================

            const result = await db.query(
                `INSERT INTO transactions (
                    statement_id,
                    statement_period,
                    line_no,
                    transaction_date,
                    posting_date,
                    description,
                    normalized_description,
                    counterparty_ref,
                    original_amount,
                    original_currency,
                    statement_fx_rate,
                    billed_amount,
                    billed_currency,
                    status,
                    coverage_state,
                    ignore_reason,
                    row_hash,
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
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17,
                    $18
                )
                RETURNING *`,
                [
                    statement_id,
                    statement_period,
                    line_no ?? null,
                    transaction_date,
                    posting_date || null,
                    description,
                    normalized_description,
                    counterparty_ref || null,
                    original_amount ?? null,
                    original_currency || null,
                    statement_fx_rate ?? null,
                    billed_amount,
                    billed_currency,
                    status,
                    coverage_state,
                    ignore_reason || null,
                    row_hash,
                    spam
                ]
            );


            return res.status(201).json({
                success: true,
                transaction: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            // Duplicate row_hash
            if (err.code === "23505") {

                return res.status(409).json({
                    success: false,
                    error:
                        "A transaction with this row_hash already exists"
                });
            }

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // UPDATE TRANSACTION
    //
    // Can update:
    // - all normal fields
    // - only spam
    // - normal fields + spam
    // ============================================================

    async updateTransaction(req, res) {

        const { transactionid } = req.params;

        const {
            statement_period,
            line_no,
            transaction_date,
            posting_date,
            description,
            normalized_description,
            counterparty_ref,
            original_amount,
            original_currency,
            statement_fx_rate,
            billed_amount,
            billed_currency,
            status,
            coverage_state,
            ignore_reason,
            row_hash,
            spam
        } = req.body;


        try {

            // ====================================================
            // CHECK EXISTS
            // ====================================================

            const existing = await db.query(
                `SELECT id
                 FROM transactions
                 WHERE id = $1`,
                [transactionid]
            );

            if (existing.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Transaction not found"
                });
            }


            // ====================================================
            // VALIDATE STATUS
            // ====================================================

            if (
                status !== undefined &&
                !VALID_STATUSES.includes(status)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid status"
                });
            }


            // ====================================================
            // VALIDATE COVERAGE STATE
            // ====================================================

            if (
                coverage_state !== undefined &&
                !VALID_COVERAGE_STATES.includes(coverage_state)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid coverage_state"
                });
            }


            // ====================================================
            // VALIDATE SPAM
            // ====================================================

            if (
                spam !== undefined &&
                typeof spam !== "boolean"
            ) {

                return res.status(400).json({
                    success: false,
                    error: "spam must be true or false"
                });
            }


            // ====================================================
            // IGNORED TRANSACTION REQUIRES REASON
            // ====================================================

            if (
                status === "ignored" &&
                !ignore_reason
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "ignore_reason is required when status is ignored"
                });
            }


            // ====================================================
            // UPDATE
            // ====================================================

            const result = await db.query(
                `UPDATE transactions
                 SET
                    statement_period =
                        COALESCE($1, statement_period),

                    line_no =
                        COALESCE($2, line_no),

                    transaction_date =
                        COALESCE($3, transaction_date),

                    posting_date =
                        COALESCE($4, posting_date),

                    description =
                        COALESCE($5, description),

                    normalized_description =
                        COALESCE($6, normalized_description),

                    counterparty_ref =
                        COALESCE($7, counterparty_ref),

                    original_amount =
                        COALESCE($8, original_amount),

                    original_currency =
                        COALESCE($9, original_currency),

                    statement_fx_rate =
                        COALESCE($10, statement_fx_rate),

                    billed_amount =
                        COALESCE($11, billed_amount),

                    billed_currency =
                        COALESCE($12, billed_currency),

                    status =
                        COALESCE($13, status),

                    coverage_state =
                        COALESCE($14, coverage_state),

                    ignore_reason =
                        COALESCE($15, ignore_reason),

                    row_hash =
                        COALESCE($16, row_hash),

                    spam =
                        COALESCE($17, spam)

                 WHERE id = $18

                 RETURNING *`,
                [
                    statement_period ?? null,
                    line_no ?? null,
                    transaction_date ?? null,
                    posting_date ?? null,
                    description ?? null,
                    normalized_description ?? null,
                    counterparty_ref ?? null,
                    original_amount ?? null,
                    original_currency ?? null,
                    statement_fx_rate ?? null,
                    billed_amount ?? null,
                    billed_currency ?? null,
                    status ?? null,
                    coverage_state ?? null,
                    ignore_reason ?? null,
                    row_hash ?? null,
                    spam ?? null,
                    transactionid
                ]
            );


            return res.json({
                success: true,
                transaction: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            if (err.code === "23505") {

                return res.status(409).json({
                    success: false,
                    error:
                        "A transaction with this row_hash already exists"
                });
            }

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // DELETE TRANSACTION
    // ============================================================

    async deleteTransaction(req, res) {

        const { transactionid } = req.params;

        try {

            const result = await db.query(
                `DELETE FROM transactions
                 WHERE id = $1
                 RETURNING *`,
                [transactionid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Transaction not found"
                });
            }


            return res.json({
                success: true,
                transaction: result.rows[0]
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
    transactionController
};