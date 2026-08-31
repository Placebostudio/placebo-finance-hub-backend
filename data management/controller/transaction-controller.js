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

            const {
                statement_id,
                statement_period,
                spam
            } = req.query;

            let query = `
            SELECT *
            FROM transactions
        `;

            const conditions = [];
            const params = [];

            // ============================================================
            // STATEMENT
            // ============================================================

            if (statement_id) {

                params.push(statement_id);

                conditions.push(
                    `statement_id = $${params.length}`
                );
            }

            // ============================================================
            // ACCOUNTING PERIOD
            // ============================================================

            if (statement_period) {

                params.push(statement_period);

                conditions.push(
                    `statement_period = $${params.length}`
                );
            }

            // ============================================================
            // SPAM
            // ============================================================

            if (spam === "true" || spam === "false") {

                params.push(
                    spam === "true"
                );

                conditions.push(
                    `spam = $${params.length}`
                );
            }

            // ============================================================
            // WHERE
            // ============================================================

            if (conditions.length > 0) {

                query += `
                WHERE ${conditions.join(" AND ")}
            `;
            }

            // ============================================================
            // ORDER
            // ============================================================

            query += `
            ORDER BY
                transaction_date DESC,
                line_no ASC
        `;

            const result = await db.query(
                query,
                params
            );

            return res.json(result.rows);

        } catch (err) {

            console.error(
                "Failed to get transactions:",
                err
            );

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
                    $17
                )
                RETURNING *`,
                [
                    statement_id,
                    statement_period,
                    line_no ?? null,
                    transaction_date,
                    posting_date ?? null,
                    description,
                    normalized_description,
                    counterparty_ref ?? null,
                    original_amount ?? null,
                    original_currency ?? null,
                    billed_amount,
                    billed_currency,
                    status,
                    coverage_state,
                    ignore_reason ?? null,
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
    // CREATE MANY TRANSACTIONS
    //
    // Creates all transactions inside one database transaction.
    // ============================================================

    async createBulk(req, res) {

        const client = await db.connect();

        try {

            const {
                statementId,
                statementPeriod,
                transactions
            } = req.body;


            // ====================================================
            // VALIDATE REQUEST
            // ====================================================

            if (!statementId) {

                return res.status(400).json({
                    success: false,
                    error: "statementId is required"
                });
            }

            if (!statementPeriod) {

                return res.status(400).json({
                    success: false,
                    error: "statementPeriod is required"
                });
            }

            if (
                !Array.isArray(transactions) ||
                transactions.length === 0
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "transactions must be a non-empty array"
                });
            }


            // ====================================================
            // CHECK STATEMENT EXISTS
            // ====================================================

            const statement = await client.query(
                `SELECT id, period
             FROM statements
             WHERE id = $1`,
                [statementId]
            );

            if (statement.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Statement not found"
                });
            }


            // ====================================================
            // CHECK PERIOD MATCHES STATEMENT
            // ====================================================

            if (statement.rows[0].period !== statementPeriod) {

                return res.status(400).json({
                    success: false,
                    error:
                        "statementPeriod does not match statement period"
                });
            }


            // ====================================================
            // START DATABASE TRANSACTION
            // ====================================================

            await client.query("BEGIN");


            const created = [];


            // ====================================================
            // INSERT EACH TRANSACTION
            // ====================================================

            for (let i = 0; i < transactions.length; i++) {

                const data = transactions[i];


                // ------------------------------------------------
                // REQUIRED FIELDS
                // ------------------------------------------------

                if (
                    !data.transaction_date ||
                    !data.description ||
                    !data.normalized_description ||
                    data.billed_amount === undefined ||
                    data.billed_amount === null ||
                    !data.row_hash
                ) {

                    throw new Error(
                        `Invalid transaction at index ${i}`
                    );
                }


                // ------------------------------------------------
                // STATUS
                // ------------------------------------------------

                const status =
                    data.status ??
                    "unmatched";

                if (!VALID_STATUSES.includes(status)) {

                    throw new Error(
                        `Invalid status at transaction index ${i}`
                    );
                }


                // ------------------------------------------------
                // COVERAGE STATE
                // ------------------------------------------------

                const coverageState =
                    data.coverage_state ??
                    "unmatched";

                if (
                    !VALID_COVERAGE_STATES.includes(
                        coverageState
                    )
                ) {

                    throw new Error(
                        `Invalid coverage_state at transaction index ${i}`
                    );
                }


                // ------------------------------------------------
                // SPAM
                // ------------------------------------------------

                const spam =
                    data.spam ??
                    false;

                if (typeof spam !== "boolean") {

                    throw new Error(
                        `spam must be true or false at transaction index ${i}`
                    );
                }


                // ------------------------------------------------
                // INSERT
                // ------------------------------------------------

                const result = await client.query(
                    `INSERT INTO transactions (
                    statement_id,
                    statement_period,
                    line_no,
                    transaction_date,
                    posting_date,
                    description,
                    normalized_description,
                    counterparty_ref,
                    original_currency,
                    billed_amount,
                    billed_currency,
                    status,
                    coverage_state,
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
                    $15
                )
                RETURNING *`,
                    [

                        // statement_id
                        statementId,

                        // statement_period
                        statementPeriod,

                        // line_no
                        data.line_no ?? i + 1,

                        // transaction_date
                        data.transaction_date,

                        // posting_date
                        data.posting_date ?? null,

                        // description
                        data.description,

                        // normalized_description
                        data.normalized_description,

                        // counterparty_ref
                        data.counterparty_ref ?? null,

                        // original_currency
                        data.original_currency ?? null,

                        // billed_amount
                        data.billed_amount,

                        // billed_currency
                        data.billed_currency ?? "SEK",

                        // status
                        status,

                        // coverage_state
                        coverageState,

                        // row_hash
                        data.row_hash,

                        // spam
                        spam
                    ]
                );


                created.push(
                    result.rows[0]
                );
            }


            // ====================================================
            // COMMIT
            // ====================================================

            await client.query("COMMIT");


            // ====================================================
            // RESPONSE
            // ====================================================

            return res.status(201).json({
                success: true,
                transactions: created
            });


        } catch (err) {

            // ====================================================
            // ROLLBACK
            // ====================================================

            await client.query("ROLLBACK");


            console.error(
                "createBulk transactions error:",
                err
            );


            // ====================================================
            // DUPLICATE ROW HASH
            // ====================================================

            if (err.code === "23505") {

                return res.status(409).json({
                    success: false,
                    error:
                        "A transaction with this row_hash already exists"
                });
            }


            // ====================================================
            // FOREIGN KEY
            // ====================================================

            if (err.code === "23503") {

                return res.status(400).json({
                    success: false,
                    error:
                        "Referenced statement does not exist"
                });
            }


            // ====================================================
            // OTHER ERROR
            // ====================================================

            return res.status(500).json({
                success: false,
                error:
                    err.message ||
                    "Failed to create transactions"
            });


        } finally {

            client.release();
        }
    },


    // ============================================================
    // UPDATE TRANSACTION
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
                !VALID_COVERAGE_STATES.includes(
                    coverage_state
                )
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

                    billed_amount =
                        COALESCE($10, billed_amount),

                    billed_currency =
                        COALESCE($11, billed_currency),

                    status =
                        COALESCE($12, status),

                    coverage_state =
                        COALESCE($13, coverage_state),

                    ignore_reason =
                        COALESCE($14, ignore_reason),

                    row_hash =
                        COALESCE($15, row_hash),

                    spam =
                        COALESCE($16, spam)

                 WHERE id = $17

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