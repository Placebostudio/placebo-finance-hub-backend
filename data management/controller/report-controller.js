const db = require("../../db_connection");

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

    async getExpenseLedger(req, res) {
        try {

            const result = await db.query(`
            SELECT
                -- ====================================================
                -- EXPENSE
                -- ====================================================

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

                -- ====================================================
                -- CATEGORY
                -- ====================================================

                c.id AS category_id,
                c.name AS category_name,

                -- ====================================================
                -- DOCUMENT
                -- ====================================================

                d.id AS document_id,
                d.file_name AS document_file_name,
                d.storage_path AS document_storage_path,
                d.document_type AS linked_document_type,
                d.document_number AS linked_document_number,
                d.document_date AS linked_document_date,

                -- ====================================================
                -- MATCH
                -- ====================================================

                m.id AS match_id,
                m.status AS match_status,
                m.match_score,
                m.is_confirmed AS match_confirmed,

                -- ====================================================
                -- TRANSACTION
                -- ====================================================

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

                -- ====================================================
                -- STATEMENT
                -- ====================================================

                s.id AS statement_id,
                s.statement_type,
                s.period AS statement_period_value,
                s.account_label,
                s.account_ref,
                s.period_from,
                s.period_to,
                s.source AS statement_source,
                s.file_name AS statement_file_name

            FROM expenses e

            -- Category
            LEFT JOIN categories c
                ON c.id = e.category_id

            -- Supporting document
            LEFT JOIN documents d
                ON d.id = e.document_id

            -- Expense ↔ transaction match
            LEFT JOIN matches m
                ON m.expense_id = e.id
                AND m.is_confirmed = true

            -- Matched transaction
            LEFT JOIN transactions t
                ON t.id = m.transaction_id

            -- Bank / credit-card statement
            LEFT JOIN statements s
                ON s.id = t.statement_id

            WHERE
                e.deleted_at IS NULL
                AND e.status = 'approved'

            ORDER BY
                e.document_date DESC,
                e.created_at DESC
        `);

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