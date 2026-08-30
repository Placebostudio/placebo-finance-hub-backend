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

            const {
                statement_type,
                period,
                source,
                spam
            } = req.query;

            let query = `
                SELECT
                    id,
                    statement_type,
                    period,
                    source,
                    column_mapping_id,
                    file_name,
                    transaction_count,
                    uploaded_by,
                    created_at,
                    spam
                FROM statements
            `;

            const conditions = [];
            const params = [];

            if (statement_type) {

                params.push(statement_type);

                conditions.push(
                    `statement_type = $${params.length}`
                );
            }

            if (period) {

                params.push(period);

                conditions.push(
                    `period = $${params.length}`
                );
            }

            if (source) {

                params.push(source);

                conditions.push(
                    `source = $${params.length}`
                );
            }

            if (spam === "true" || spam === "false") {

                params.push(
                    spam === "true"
                );

                conditions.push(
                    `spam = $${params.length}`
                );
            }

            if (conditions.length > 0) {

                query += `
                    WHERE ${conditions.join(" AND ")}
                `;
            }

            query += `
                ORDER BY period DESC, created_at DESC
            `;

            const result = await db.query(
                query,
                params
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
                    source,
                    column_mapping_id,
                    file_name,
                    transaction_count,
                    uploaded_by,
                    created_at,
                    spam
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
            source,
            column_mapping_id,
            file_name,
            transaction_count = 0,
            uploaded_by,
            spam = false
        } = req.body;


        try {

            // ====================================================
            // REQUIRED FIELDS
            // ====================================================

            if (
                !statement_type ||
                !period ||
                !source
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "statement_type, period and source are required"
                });
            }


            // ====================================================
            // VALIDATE STATEMENT TYPE
            // ====================================================

            if (
                !VALID_STATEMENT_TYPES.includes(
                    statement_type
                )
            ) {

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

            if (
                !VALID_SOURCES.includes(source)
            ) {

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

            if (
                !/^\d{4}-(0[1-9]|1[0-2])$/.test(
                    period
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "period must use YYYY-MM format"
                });
            }


            // ====================================================
            // VALIDATE TRANSACTION COUNT
            // ====================================================

            if (
                !Number.isInteger(
                    Number(transaction_count)
                ) ||
                Number(transaction_count) < 0
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "transaction_count must be a non-negative integer"
                });
            }


            // ====================================================
            // VALIDATE SPAM
            // ====================================================

            if (
                typeof spam !== "boolean"
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "spam must be true or false"
                });
            }


            // ====================================================
            // INSERT
            // ====================================================

            const result = await db.query(
                `INSERT INTO statements (
                    statement_type,
                    period,
                    source,
                    column_mapping_id,
                    file_name,
                    transaction_count,
                    uploaded_by,
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
                    $8
                )
                RETURNING *`,
                [
                    statement_type,
                    period,
                    source,
                    column_mapping_id || null,
                    file_name || null,
                    Number(transaction_count),
                    uploaded_by || null,
                    spam
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
            source,
            column_mapping_id,
            file_name,
            transaction_count,
            uploaded_by,
            spam
        } = req.body;


        try {

            // ====================================================
            // CHECK EXISTS
            // ====================================================

            const existing = await db.query(
                `SELECT *
                 FROM statements
                 WHERE id = $1`,
                [statementid]
            );

            if (
                existing.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Statement not found"
                });
            }


            // ====================================================
            // VALIDATE STATEMENT TYPE
            // ====================================================

            if (
                statement_type !== undefined &&
                !VALID_STATEMENT_TYPES.includes(
                    statement_type
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid statement_type"
                });
            }


            // ====================================================
            // VALIDATE SOURCE
            // ====================================================

            if (
                source !== undefined &&
                !VALID_SOURCES.includes(
                    source
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid source"
                });
            }


            // ====================================================
            // VALIDATE PERIOD
            // ============================================================

            if (
                period !== undefined &&
                !/^\d{4}-(0[1-9]|1[0-2])$/.test(
                    period
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "period must use YYYY-MM format"
                });
            }


            // ====================================================
            // VALIDATE TRANSACTION COUNT
            // ====================================================

            if (
                transaction_count !== undefined &&
                (
                    !Number.isInteger(
                        Number(transaction_count)
                    ) ||
                    Number(transaction_count) < 0
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "transaction_count must be a non-negative integer"
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
                    error:
                        "spam must be true or false"
                });
            }


            // ====================================================
            // UPDATE
            // ====================================================

            const result = await db.query(
                `UPDATE statements
                 SET
                    statement_type =
                        COALESCE(
                            $1,
                            statement_type
                        ),

                    period =
                        COALESCE(
                            $2,
                            period
                        ),

                    source =
                        COALESCE(
                            $3,
                            source
                        ),

                    column_mapping_id =
                        COALESCE(
                            $4,
                            column_mapping_id
                        ),

                    file_name =
                        COALESCE(
                            $5,
                            file_name
                        ),

                    transaction_count =
                        COALESCE(
                            $6,
                            transaction_count
                        ),

                    uploaded_by =
                        COALESCE(
                            $7,
                            uploaded_by
                        ),

                    spam =
                        COALESCE(
                            $8,
                            spam
                        )

                 WHERE id = $9

                 RETURNING *`,
                [
                    statement_type ?? null,
                    period ?? null,
                    source ?? null,
                    column_mapping_id ?? null,
                    file_name ?? null,
                    transaction_count !== undefined
                        ? Number(transaction_count)
                        : null,
                    uploaded_by ?? null,
                    spam ?? null,
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
    // DELETE STATEMENT
    // ============================================================

    async deleteStatement(req, res) {

        const { statementid } = req.params;

        try {

            const result = await db.query(
                `DELETE FROM statements
                 WHERE id = $1
                 RETURNING *`,
                [statementid]
            );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Statement not found"
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