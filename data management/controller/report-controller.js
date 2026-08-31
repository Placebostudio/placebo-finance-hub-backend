const db = require("../../db_connection");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);
const BUCKET_NAME = "documents";

const reportController = {

    // ============================================================
    // GET ALL REPORTS
    // ============================================================

    // ============================================================
    // GET ALL REPORTS
    // ============================================================

    async getReports(req, res) {

        try {

            // ====================================================
            // CHECK USER + PERMISSION
            // ====================================================

            const user_id =
                req.query.user_id;

            const permissionResult =
                await db.query(
                    `
                SELECT role
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                    [user_id]
                );


            if (permissionResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const userRole =
                permissionResult.rows[0].role;


            if (
                userRole !== "viewer" &&
                userRole !== "manager" &&
                userRole !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ====================================================
            // GET REPORTS
            // ====================================================

            const { spam } =
                req.query;


            let query = `
            SELECT *
            FROM reports
            WHERE 1 = 1
        `;

            const params = [];


            if (spam !== undefined) {

                params.push(
                    spam === "true"
                );

                query += `
                AND spam = $${params.length}
            `;
            }


            query += `
            ORDER BY generated_at DESC
        `;


            const result =
                await db.query(
                    query,
                    params
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
    // GET ONE REPORT
    // ============================================================

    async getReport(req, res) {

        // ============================================================
        // CHECK USER + PERMISSION
        // ============================================================

        const user_id =
            req.query.user_id;

        try {

            const permissionResult =
                await db.query(
                    `
                SELECT role
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                    [user_id]
                );


            if (permissionResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const userRole =
                permissionResult.rows[0].role;


            if (
                userRole !== "viewer" &&
                userRole !== "manager" &&
                userRole !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ====================================================
            // SPECIAL REPORT: EXPENSE LEDGER
            // ====================================================

            if (
                req.params.reportid ===
                "expense-ledger"
            ) {

                return reportController.getExpenseLedger(
                    req,
                    res
                );
            }


            // ====================================================
            // GET REPORT
            // ====================================================

            const result =
                await db.query(
                    `
                SELECT *
                FROM reports
                WHERE id = $1
                `,
                    [req.params.reportid]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Report not found"
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
    // CREATE REPORT
    // ============================================================

    async addReport(req, res) {

        try {

            const {
                period,
                project_id,
                kind,
                storage_path,
                generated_by,
                is_current = true,
                spam = false,
                user_id
            } = req.body;


            // ====================================================
            // CHECK USER + PERMISSION
            // ====================================================

            const permissionResult =
                await db.query(
                    `
                SELECT role
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                    [user_id]
                );


            if (permissionResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const userRole =
                permissionResult.rows[0].role;


            if (
                userRole !== "manager" &&
                userRole !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
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
            // CREATE REPORT
            // ====================================================

            const result =
                await db.query(
                    `
                INSERT INTO reports (
                    period,
                    project_id,
                    kind,
                    storage_path,
                    generated_by,
                    is_current,
                    spam
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )
                RETURNING *
                `,
                    [
                        period,
                        project_id || null,
                        kind,
                        storage_path,
                        generated_by || null,
                        is_current,
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
    // UPDATE REPORT
    //
    // Can update:
    // - all normal fields
    // - only spam
    // - normal fields + spam
    // ============================================================

    async updateReport(req, res) {

        try {

            const {
                period,
                project_id,
                kind,
                storage_path,
                generated_by,
                is_current,
                spam,
                user_id
            } = req.body;


            // ====================================================
            // CHECK USER + PERMISSION
            // ====================================================

            const permissionResult =
                await db.query(
                    `
                SELECT role
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                    [user_id]
                );


            if (permissionResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const userRole =
                permissionResult.rows[0].role;


            // Manager and owner can update
            if (
                userRole !== "manager" &&
                userRole !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
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
            // UPDATE
            // ====================================================

            const result =
                await db.query(
                    `
                UPDATE reports
                SET
                    period =
                        COALESCE($1, period),

                    project_id =
                        COALESCE($2, project_id),

                    kind =
                        COALESCE($3, kind),

                    storage_path =
                        COALESCE($4, storage_path),

                    generated_by =
                        COALESCE($5, generated_by),

                    is_current =
                        COALESCE($6, is_current),

                    spam =
                        COALESCE($7, spam)

                WHERE id = $8

                RETURNING *
                `,
                    [
                        period ?? null,
                        project_id ?? null,
                        kind ?? null,
                        storage_path ?? null,
                        generated_by ?? null,
                        is_current ?? null,
                        spam !== undefined
                            ? spam
                            : null,
                        req.params.reportid
                    ]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Report not found"
                });
            }


            return res.json({
                success: true,
                report: result.rows[0]
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
    // DELETE REPORT
    // ============================================================

    async deleteReport(req, res) {

        try {

            const {
                user_id
            } = req.body;


            // ====================================================
            // CHECK USER + PERMISSION
            // ====================================================

            const permissionResult =
                await db.query(
                    `
                SELECT role
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                    [user_id]
                );


            if (permissionResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            const userRole =
                permissionResult.rows[0].role;


            // ====================================================
            // ONLY OWNER CAN DELETE
            // ====================================================

            if (userRole !== "owner") {

                return res.status(403).json({
                    success: false,
                    error:
                        "Only owner can permanently delete reports"
                });
            }


            // ====================================================
            // DELETE
            // ====================================================

            const result =
                await db.query(
                    `
                DELETE FROM reports
                WHERE id = $1
                RETURNING *
                `,
                    [req.params.reportid]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Report not found"
                });
            }


            return res.json({
                success: true,
                report: result.rows[0]
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
    // EXPENSE LEDGER
    // GET /api/reports/expense-ledger
    //
    // Joins expenses → categories → documents → matches →
    //                  transactions → statements
    //
    // Query params (all optional):
    //   period          YYYY-MM
    //   payment_method  credit_card | bank_transfer | cash | other | unknown
    //   category_id     UUID
    //   coverage_state  unmatched | partially_matched | fully_matched
    //   status          draft | approved | rejected
    //   search          free-text (vendor_name, document_number, txn description)
    //   receipt_status  attached | missing
    // ============================================================

    async getExpenseLedger(req, res) {

        const {
            period,
            payment_method,
            receipt_status,
            coverage_state,
            search,
            user_id
        } = req.query;


        try {

            // ============================================================
            // CHECK USER + PERMISSION
            // ============================================================

            const userResult = await db.query(
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


            const userRole = userResult.rows[0].role;


            // ============================================================
            // VIEWER / MANAGER / OWNER CAN VIEW
            // ============================================================

            if (
                userRole !== "viewer" &&
                userRole !== "manager" &&
                userRole !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ============================================================
            // LOAD EXPENSE LEDGER
            // ============================================================

            const result = await db.query(
                `
            SELECT
                e.id AS expense_id,
                e.expense_no,
                e.document_id,
                e.project_id,
                e.vendor_id,
                e.vendor_name,
                e.document_type,
                e.document_number,
                e.document_date,
                e.due_date,
                e.currency,
                e.country_code,
                e.net_amount,
                e.vat_amount,
                e.vat_rate,
                e.gross_amount,
                e.paid_amount,
                e.fx_rate,
                e.fx_date,
                e.fx_source,
                e.gross_amount_sek,
                e.paid_amount_sek,
                e.vat_amount_sek,
                e.is_reverse_charge,
                e.is_vat_deductible,
                e.payment_method,
                e.coverage_state,
                e.notes,
                e.status,
                e.created_by,
                e.approved_by,
                e.approved_at,

                c.id AS category_id,
                c.name AS category_name,

                d.id AS linked_document_id,
                d.document_no AS linked_document_no,
                d.file_name AS document_file_name,
                d.file_type AS document_file_type,
                d.file_size AS document_file_size,
                d.storage_path AS document_storage_path,
                d.checksum_sha256 AS document_checksum,
                d.page_count AS document_page_count,
                d.status AS document_status,
                d.extraction_status AS document_extraction_status,
                d.notes AS document_notes,
                d.uploaded_by AS document_uploaded_by,
                d.uploaded_at AS document_uploaded_at,

                m.id AS match_id,
                m.allocated_amount AS match_allocated_amount,
                m.score AS match_score,
                m.match_type,
                m.reasons AS match_reasons,
                m.status AS match_status,
                m.confirmed_by AS match_confirmed_by,
                m.confirmed_at AS match_confirmed_at,

                t.id AS transaction_id,
                t.statement_id,
                t.statement_period,
                t.line_no,
                t.transaction_date,
                t.posting_date,
                t.description,
                t.normalized_description,
                t.counterparty_ref,
                t.original_currency,
                t.billed_amount,
                t.billed_currency,
                t.status AS transaction_status,
                t.coverage_state AS transaction_coverage_state,

                s.id AS linked_statement_id,
                s.statement_type,
                s.period AS statement_period_value,
                s.source AS statement_source,
                s.column_mapping_id,
                s.file_name AS statement_file_name,
                s.transaction_count AS statement_transaction_count,
                s.uploaded_by AS statement_uploaded_by,
                s.created_at AS statement_created_at

            FROM expenses e

            LEFT JOIN categories c
                ON c.id = e.category_id

            LEFT JOIN documents d
                ON d.id = e.document_id
                AND d.deleted_at IS NULL
                AND d.spam = false

            LEFT JOIN matches m
                ON m.expense_id = e.id
                AND m.status = 'confirmed'
                AND m.spam = false

            LEFT JOIN transactions t
                ON t.id = m.transaction_id
                AND t.spam = false

            LEFT JOIN statements s
                ON s.id = t.statement_id
                AND s.spam = false

            WHERE
                e.deleted_at IS NULL
                AND e.status = 'approved'

                AND (
                    $1::text IS NULL
                    OR TO_CHAR(
                        e.document_date,
                        'YYYY-MM'
                    ) = $1::text
                )

                AND (
                    $2::text IS NULL
                    OR e.payment_method::text = $2::text
                )

                AND (
                    $3::text IS NULL
                    OR (
                        $3::text = 'attached'
                        AND d.id IS NOT NULL
                    )
                    OR (
                        $3::text = 'missing'
                        AND d.id IS NULL
                    )
                )

                AND (
                    $4::text IS NULL
                    OR e.coverage_state::text = $4::text
                )

                AND (
                    $5::text IS NULL
                    OR LOWER(e.vendor_name)
                        LIKE LOWER('%' || $5::text || '%')

                    OR LOWER(e.document_number)
                        LIKE LOWER('%' || $5::text || '%')

                    OR LOWER(t.description)
                        LIKE LOWER('%' || $5::text || '%')
                )

            ORDER BY
                e.document_date DESC,
                e.created_at DESC
            `,
                [
                    period || null,
                    payment_method || null,
                    receipt_status || null,
                    coverage_state || null,
                    search || null
                ]
            );


            return res.json(result.rows);


        } catch (err) {

            console.error(
                "Failed to load expense ledger:",
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
    reportController
};