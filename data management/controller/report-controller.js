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

    async getReports(req, res) {
        try {
            const result = await db.query(`
                SELECT *
                FROM reports
                ORDER BY generated_at DESC
            `);

            res.json(result.rows);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },


    // ============================================================
    // GET ONE REPORT
    // ============================================================

    async getReport(req, res) {
        // ============================================================
        // SPECIAL REPORT: EXPENSE LEDGER
        // ============================================================

        if (req.params.reportid === "expense-ledger") {

            return reportController.getExpenseLedger(
                req,
                res
            );
        }

        try {
            const result = await db.query(`
                SELECT *
                FROM reports
                WHERE id = $1
            `, [req.params.reportid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Report not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
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
                spam = false
            } = req.body;


            // ====================================================
            // VALIDATE SPAM
            // ====================================================

            if (typeof spam !== "boolean") {
                return res.status(400).json({
                    error: "spam must be true or false"
                });
            }


            const result = await db.query(`
                INSERT INTO reports (
                    period,
                    project_id,
                    kind,
                    storage_path,
                    generated_by,
                    is_current,
                    spam
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                period,
                project_id || null,
                kind,
                storage_path,
                generated_by || null,
                is_current,
                spam
            ]);

            res.status(201).json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
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
                spam
            } = req.body;


            // ====================================================
            // VALIDATE SPAM
            // ====================================================

            if (
                spam !== undefined &&
                typeof spam !== "boolean"
            ) {
                return res.status(400).json({
                    error: "spam must be true or false"
                });
            }


            const result = await db.query(`
                UPDATE reports
                SET
                    period = COALESCE($1, period),
                    project_id = COALESCE($2, project_id),
                    kind = COALESCE($3, kind),
                    storage_path = COALESCE($4, storage_path),
                    generated_by = COALESCE($5, generated_by),
                    is_current = COALESCE($6, is_current),
                    spam = COALESCE($7, spam)
                WHERE id = $8
                RETURNING *
            `, [
                period ?? null,
                project_id ?? null,
                kind ?? null,
                storage_path ?? null,
                generated_by ?? null,
                is_current ?? null,
                spam !== undefined ? spam : null,
                req.params.reportid
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Report not found"
                });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },



    // ============================================================
    // DELETE REPORT
    // ============================================================

    async deleteReport(req, res) {
        try {
            const result = await db.query(`
                DELETE FROM reports
                WHERE id = $1
                RETURNING *
            `, [req.params.reportid]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Report not found"
                });
            }

            res.json({
                success: true,
                report: result.rows[0]
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
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
            search
        } = req.query;

        try {
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
                t.original_amount,
                t.original_currency,
                t.statement_fx_rate,
                t.billed_amount,
                t.billed_currency,
                t.status AS transaction_status,
                t.coverage_state AS transaction_coverage_state,

                s.id AS linked_statement_id,
                s.statement_type,
                s.period AS statement_period_value,
                s.account_label,
                s.account_ref,
                s.period_from,
                s.period_to,
                s.opening_balance,
                s.closing_balance,
                s.total_amount,
                s.source AS statement_source,
                s.file_name AS statement_file_name,
                s.storage_path AS statement_storage_path,
                s.transaction_count AS statement_transaction_count,
                s.is_locked AS statement_is_locked

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

            LEFT JOIN statements s
                ON s.id = t.statement_id

            WHERE
                e.deleted_at IS NULL
                AND e.status = 'approved'

                AND (
                    $1::text IS NULL
                     OR TO_CHAR(e.document_date, 'YYYY-MM') = $1::text
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
                    OR LOWER(e.vendor_name) LIKE LOWER('%' || $5::text || '%')
                    OR LOWER(e.document_number) LIKE LOWER('%' || $5::text || '%')
                    OR LOWER(t.description) LIKE LOWER('%' || $5::text || '%')
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
            console.error(err);

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