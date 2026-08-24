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
        try {
            const clean = (v) => (v && v.trim()) ? v.trim() : null;

            const period         = clean(req.query.period);
            const payment_method = clean(req.query.payment_method);
            const category_id    = clean(req.query.category_id);
            const coverage_state = clean(req.query.coverage_state);
            const status         = clean(req.query.status);
            const search         = clean(req.query.search);
            const receipt_status = clean(req.query.receipt_status);

            const result = await db.query(`
                SELECT
                  e.id,
                  e.expense_no,
                  e.vendor_name,
                  e.document_type,
                  e.document_number,
                  e.document_date,
                  e.currency,
                  e.gross_amount,
                  e.net_amount,
                  e.vat_amount,
                  e.vat_rate,
                  e.payment_method,
                  e.coverage_state,
                  e.notes,
                  e.status,
                  e.approved_at,

                  c.id   AS category_id,
                  c.name AS category_name,

                  d.id           AS doc_id,
                  d.file_name    AS doc_file_name,
                  d.file_type    AS doc_file_type,
                  d.storage_path AS doc_storage_path,

                  m.id           AS match_id,
                  m.match_type,
                  m.score        AS match_score,
                  m.confirmed_at AS match_confirmed_at,

                  t.id               AS txn_id,
                  t.transaction_date AS txn_date,
                  t.description      AS txn_description,
                  t.billed_amount    AS txn_billed_amount,
                  t.billed_currency  AS txn_billed_currency,
                  t.counterparty_ref AS txn_counterparty_ref,

                  s.id             AS stmt_id,
                  s.statement_type AS stmt_type,
                  s.account_label  AS stmt_account_label,
                  s.period         AS stmt_period

                FROM expenses e
                LEFT JOIN categories  c  ON e.category_id    = c.id
                LEFT JOIN documents   d  ON e.document_id    = d.id
                                        AND d.deleted_at IS NULL
                LEFT JOIN matches     m  ON m.expense_id     = e.id
                                        AND m.status = 'confirmed'
                LEFT JOIN transactions t  ON m.transaction_id = t.id
                LEFT JOIN statements   s  ON t.statement_id   = s.id

                WHERE e.deleted_at IS NULL
                  AND ($1::text IS NULL OR to_char(e.document_date, 'YYYY-MM') = $1)
                  AND ($2::text IS NULL OR e.payment_method::text = $2)
                  AND ($3::text IS NULL OR e.category_id::text = $3)
                  AND ($4::text IS NULL OR e.coverage_state::text = $4)
                  AND ($5::text IS NULL OR e.status::text = $5)
                  AND ($6::text IS NULL OR (
                    e.vendor_name     ILIKE '%' || $6 || '%' OR
                    e.document_number ILIKE '%' || $6 || '%' OR
                    t.description     ILIKE '%' || $6 || '%'
                  ))
                  AND (
                    $7::text IS NULL OR
                    ($7 = 'attached' AND d.id IS NOT NULL) OR
                    ($7 = 'missing'  AND d.id IS NULL)
                  )

                ORDER BY e.document_date DESC, e.expense_no DESC
            `, [
                period,
                payment_method,
                category_id,
                coverage_state,
                status,
                search,
                receipt_status
            ]);

            const expenses = result.rows.map(row => {
                let documentUrl = null;
                if (row.doc_storage_path) {
                    const { data } = supabase.storage
                        .from(BUCKET_NAME)
                        .getPublicUrl(row.doc_storage_path);
                    documentUrl = data.publicUrl;
                }

                return {
                    id:             row.id,
                    expense_no:     row.expense_no,
                    vendor_name:    row.vendor_name,
                    document_type:  row.document_type,
                    document_number: row.document_number,
                    document_date:  row.document_date,
                    currency:       row.currency,
                    gross_amount:   parseFloat(row.gross_amount),
                    net_amount:     row.net_amount   != null ? parseFloat(row.net_amount)   : null,
                    vat_amount:     row.vat_amount   != null ? parseFloat(row.vat_amount)   : null,
                    vat_rate:       row.vat_rate     != null ? parseFloat(row.vat_rate)     : null,
                    payment_method: row.payment_method,
                    coverage_state: row.coverage_state,
                    notes:          row.notes,
                    status:         row.status,
                    approved_at:    row.approved_at,

                    category: row.category_id ? {
                        id:   row.category_id,
                        name: row.category_name,
                    } : null,

                    document: row.doc_id ? {
                        id:        row.doc_id,
                        file_name: row.doc_file_name,
                        file_type: row.doc_file_type,
                        url:       documentUrl,
                    } : null,

                    match: row.match_id ? {
                        id:           row.match_id,
                        match_type:   row.match_type,
                        score:        row.match_score,
                        confirmed_at: row.match_confirmed_at,

                        transaction: row.txn_id ? {
                            id:              row.txn_id,
                            transaction_date: row.txn_date,
                            description:     row.txn_description,
                            billed_amount:   row.txn_billed_amount != null ? parseFloat(row.txn_billed_amount) : null,
                            billed_currency: row.txn_billed_currency,
                            counterparty_ref: row.txn_counterparty_ref,

                            statement: row.stmt_id ? {
                                id:             row.stmt_id,
                                statement_type: row.stmt_type,
                                account_label:  row.stmt_account_label,
                                period:         row.stmt_period,
                            } : null,
                        } : null,
                    } : null,
                };
            });

            res.json({ expenses });

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
    }
};

module.exports = {
    reportController
};