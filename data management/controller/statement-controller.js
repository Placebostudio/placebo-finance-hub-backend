const db = require("../../db_connection");


const VALID_STATEMENT_TYPES = [
    "bank_account",
    "credit_card"
];

const VALID_SOURCES = [
    "csv",
    "pdf",
    "manual"
];


const statementController = {

    // ============================================================
    // GET ALL STATEMENTS
    // ============================================================

    async getStatements(req, res) {

        try {

            const result = await db.query(
                `SELECT
                    id,
                    statement_type,
                    period,
                    account_label,
                    account_ref,
                    period_from,
                    period_to,
                    opening_balance,
                    closing_balance,
                    total_amount,
                    settled_by_transaction_id,
                    source,
                    column_mapping_id,
                    file_name,
                    storage_path,
                    transaction_count,
                    is_locked,
                    uploaded_by,
                    created_at
                 FROM statements
                 ORDER BY period DESC, created_at DESC`
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
    // GET ONE STATEMENT
    // ============================================================

    async getStatement(req, res) {

        const { statementid } = req.params;

        try {

            const result = await db.query(
                `SELECT
                    id,
                    statement_type,
                    period,
                    account_label,
                    account_ref,
                    period_from,
                    period_to,
                    opening_balance,
                    closing_balance,
                    total_amount,
                    settled_by_transaction_id,
                    source,
                    column_mapping_id,
                    file_name,
                    storage_path,
                    transaction_count,
                    is_locked,
                    uploaded_by,
                    created_at
                 FROM statements
                 WHERE id = $1`,
                [statementid]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Statement not found"
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
    // ADD STATEMENT
    // ============================================================

    async addStatement(req, res) {

        const {
            statement_type,
            period,
            account_label,
            account_ref,
            period_from,
            period_to,
            opening_balance,
            closing_balance,
            total_amount,
            settled_by_transaction_id,
            source,
            column_mapping_id,
            file_name,
            storage_path,
            uploaded_by
        } = req.body;


        try {

            // ====================================================
            // REQUIRED FIELDS
            // ====================================================

            if (!statement_type || !period || !source) {

                return res.status(400).json({
                    success: false,
                    error:
                        "statement_type, period and source are required"
                });
            }


            // ====================================================
            // VALIDATE STATEMENT TYPE
            // ====================================================

            if (!VALID_STATEMENT_TYPES.includes(statement_type)) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid statement_type. Allowed values: " +
                        VALID_STATEMENT_TYPES.join(", ")
                });
            }


            // ====================================================
            // VALIDATE SOURCE
            // ====================================================

            if (!VALID_SOURCES.includes(source)) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid source. Allowed values: " +
                        VALID_SOURCES.join(", ")
                });
            }


            // ====================================================
            // VALIDATE PERIOD
            // ====================================================

            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {

                return res.status(400).json({
                    success: false,
                    error:
                        "period must use YYYY-MM format"
                });
            }


            // ====================================================
            // INSERT
            // ====================================================

            const result = await db.query(
                `INSERT INTO statements (
                    statement_type,
                    period,
                    account_label,
                    account_ref,
                    period_from,
                    period_to,
                    opening_balance,
                    closing_balance,
                    total_amount,
                    settled_by_transaction_id,
                    source,
                    column_mapping_id,
                    file_name,
                    storage_path,
                    uploaded_by
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
                    statement_type,
                    period,
                    account_label || null,
                    account_ref || null,
                    period_from || null,
                    period_to || null,
                    opening_balance ?? null,
                    closing_balance ?? null,
                    total_amount ?? null,
                    settled_by_transaction_id || null,
                    source,
                    column_mapping_id || null,
                    file_name || null,
                    storage_path || null,
                    uploaded_by || null
                ]
            );


            return res.status(201).json({
                success: true,
                statement: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // UPDATE STATEMENT
    // ============================================================

    async updateStatement(req, res) {

        const { statementid } = req.params;

        const {
            statement_type,
            period,
            account_label,
            account_ref,
            period_from,
            period_to,
            opening_balance,
            closing_balance,
            total_amount,
            settled_by_transaction_id,
            source,
            column_mapping_id,
            file_name,
            storage_path
        } = req.body;


        try {

            // ====================================================
            // CHECK IF LOCKED
            // ====================================================

            const existing = await db.query(
                `SELECT is_locked
                 FROM statements
                 WHERE id = $1`,
                [statementid]
            );

            if (existing.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Statement not found"
                });
            }


            if (existing.rows[0].is_locked) {

                return res.status(403).json({
                    success: false,
                    error:
                        "Statement is locked and cannot be modified"
                });
            }


            // ====================================================
            // VALIDATE
            // ====================================================

            if (
                statement_type !== undefined &&
                !VALID_STATEMENT_TYPES.includes(statement_type)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid statement_type"
                });
            }


            if (
                source !== undefined &&
                !VALID_SOURCES.includes(source)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid source"
                });
            }


            if (
                period !== undefined &&
                !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "period must use YYYY-MM format"
                });
            }


            // ====================================================
            // UPDATE
            // ====================================================

            const result = await db.query(
                `UPDATE statements
                 SET
                    statement_type =
                        COALESCE($1, statement_type),

                    period =
                        COALESCE($2, period),

                    account_label =
                        COALESCE($3, account_label),

                    account_ref =
                        COALESCE($4, account_ref),

                    period_from =
                        COALESCE($5, period_from),

                    period_to =
                        COALESCE($6, period_to),

                    opening_balance =
                        COALESCE($7, opening_balance),

                    closing_balance =
                        COALESCE($8, closing_balance),

                    total_amount =
                        COALESCE($9, total_amount),

                    settled_by_transaction_id =
                        COALESCE(
                            $10,
                            settled_by_transaction_id
                        ),

                    source =
                        COALESCE($11, source),

                    column_mapping_id =
                        COALESCE($12, column_mapping_id),

                    file_name =
                        COALESCE($13, file_name),

                    storage_path =
                        COALESCE($14, storage_path)

                 WHERE id = $15

                 RETURNING *`,
                [
                    statement_type ?? null,
                    period ?? null,
                    account_label ?? null,
                    account_ref ?? null,
                    period_from ?? null,
                    period_to ?? null,
                    opening_balance ?? null,
                    closing_balance ?? null,
                    total_amount ?? null,
                    settled_by_transaction_id ?? null,
                    source ?? null,
                    column_mapping_id ?? null,
                    file_name ?? null,
                    storage_path ?? null,
                    statementid
                ]
            );


            return res.json({
                success: true,
                statement: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // LOCK STATEMENT
    // ============================================================

    async lockStatement(req, res) {

        const { statementid } = req.params;

        try {

            const result = await db.query(
                `UPDATE statements
                 SET is_locked = true
                 WHERE id = $1
                 RETURNING *`,
                [statementid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Statement not found"
                });
            }


            return res.json({
                success: true,
                statement: result.rows[0]
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // UNLOCK STATEMENT
    // ============================================================

    async unlockStatement(req, res) {

        const { statementid } = req.params;

        try {

            const result = await db.query(
                `UPDATE statements
                 SET is_locked = false
                 WHERE id = $1
                 RETURNING *`,
                [statementid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Statement not found"
                });
            }


            return res.json({
                success: true,
                statement: result.rows[0]
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
    statementController
};