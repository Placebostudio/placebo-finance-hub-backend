const db = require("../../db_connection");

const VALID_DOCUMENT_TYPES = [
    "receipt",
    "invoice",
    "credit_note",
    "other"
];

const VALID_FX_SOURCES = [
    "frankfurter",
    "card_statement",
    "manual"
];

const VALID_PAYMENT_METHODS = [
    "bank_transfer",
    "credit_card",
    "cash",
    "other",
    "unknown"
];

const VALID_COVERAGE_STATES = [
    "unmatched",
    "partially_matched",
    "fully_matched"
];

const VALID_STATUSES = [
    "draft",
    "approved",
    "rejected"
];


const expenseController = {

    // ============================================================
    // GET ALL EXPENSES
    // ============================================================

    async getExpenses(req, res) {

        try {

            const result = await db.query(
                `SELECT
                    id,
                    expense_no,
                    document_id,
                    project_id,
                    vendor_id,
                    vendor_name,
                    document_type,
                    document_number,
                    document_date,
                    due_date,
                    currency,
                    country_code,
                    net_amount,
                    vat_amount,
                    vat_rate,
                    gross_amount,
                    paid_amount,
                    fx_rate,
                    fx_date,
                    fx_source,
                    gross_amount_sek,
                    paid_amount_sek,
                    vat_amount_sek,
                    is_reverse_charge,
                    is_vat_deductible,
                    category_id,
                    payment_method,
                    coverage_state,
                    notes,
                    status,
                    created_by,
                    approved_by,
                    approved_at,
                    created_at,
                    updated_at,
                    deleted_at,
                    spam
                 FROM expenses
                 WHERE deleted_at IS NULL
                 ORDER BY document_date DESC, created_at DESC`
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
    // GET ONE EXPENSE
    // ============================================================

    async getExpense(req, res) {

        const { expenseid } = req.params;

        try {

            const result = await db.query(
                `SELECT
                    id,
                    expense_no,
                    document_id,
                    project_id,
                    vendor_id,
                    vendor_name,
                    document_type,
                    document_number,
                    document_date,
                    due_date,
                    currency,
                    country_code,
                    net_amount,
                    vat_amount,
                    vat_rate,
                    gross_amount,
                    paid_amount,
                    fx_rate,
                    fx_date,
                    fx_source,
                    gross_amount_sek,
                    paid_amount_sek,
                    vat_amount_sek,
                    is_reverse_charge,
                    is_vat_deductible,
                    category_id,
                    payment_method,
                    coverage_state,
                    notes,
                    status,
                    created_by,
                    approved_by,
                    approved_at,
                    created_at,
                    updated_at,
                    deleted_at,
                    spam
                 FROM expenses
                 WHERE id = $1
                   AND deleted_at IS NULL`,
                [expenseid]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Expense not found"
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
    // ADD EXPENSE
    // ============================================================

    async addExpense(req, res) {

        const {
            document_id,
            project_id,
            vendor_id,
            vendor_name,
            document_type,
            document_number,
            document_date,
            due_date,
            currency,
            country_code,
            net_amount,
            vat_amount,
            vat_rate,
            gross_amount,
            paid_amount,
            fx_rate,
            fx_date,
            fx_source,
            gross_amount_sek,
            paid_amount_sek,
            vat_amount_sek,
            is_reverse_charge = false,
            is_vat_deductible = true,
            category_id,
            payment_method,
            coverage_state = "unmatched",
            notes,
            status = "draft",
            created_by,
            spam = false
        } = req.body;


        try {

            // ====================================================
            // REQUIRED FIELDS
            // ====================================================

            if (
                !vendor_name ||
                !document_date ||
                !currency ||
                gross_amount === undefined ||
                gross_amount === null ||
                !category_id ||
                !payment_method
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "vendor_name, document_date, currency, gross_amount, category_id and payment_method are required"
                });
            }


            // ====================================================
            // VALIDATE ENUMS
            // ====================================================

            if (!VALID_DOCUMENT_TYPES.includes(document_type)) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid document_type"
                });
            }

            if (
                !VALID_FX_SOURCES.includes(fx_source) &&
                fx_source !== undefined &&
                fx_source !== null
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid fx_source"
                });
            }

            if (!VALID_PAYMENT_METHODS.includes(payment_method)) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid payment_method"
                });
            }

            if (!VALID_COVERAGE_STATES.includes(coverage_state)) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid coverage_state"
                });
            }

            if (!VALID_STATUSES.includes(status)) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid status"
                });
            }


            // ====================================================
            // SPAM VALIDATION
            // ====================================================

            if (typeof spam !== "boolean") {

                return res.status(400).json({
                    success: false,
                    error: "spam must be a boolean"
                });
            }


            // ====================================================
            // AMOUNT VALIDATION
            // ====================================================

            if (Number(gross_amount) <= 0) {

                return res.status(400).json({
                    success: false,
                    error: "gross_amount must be greater than 0"
                });
            }


            // ====================================================
            // DEFAULT PAID AMOUNT
            // ====================================================

            const finalPaidAmount =
                paid_amount === undefined ||
                    paid_amount === null
                    ? gross_amount
                    : paid_amount;


            // ====================================================
            // INSERT
            // ====================================================

            const result = await db.query(
                `INSERT INTO expenses (
                    document_id,
                    project_id,
                    vendor_id,
                    vendor_name,
                    document_type,
                    document_number,
                    document_date,
                    due_date,
                    currency,
                    country_code,
                    net_amount,
                    vat_amount,
                    vat_rate,
                    gross_amount,
                    paid_amount,
                    fx_rate,
                    fx_date,
                    fx_source,
                    gross_amount_sek,
                    paid_amount_sek,
                    vat_amount_sek,
                    is_reverse_charge,
                    is_vat_deductible,
                    category_id,
                    payment_method,
                    coverage_state,
                    notes,
                    status,
                    created_by,
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
                    $18,
                    $19,
                    $20,
                    $21,
                    $22,
                    $23,
                    $24,
                    $25,
                    $26,
                    $27,
                    $28,
                    $29,
                    $30
                )
                RETURNING *`,
                [
                    document_id || null,
                    project_id || null,
                    vendor_id || null,
                    vendor_name,
                    document_type,
                    document_number || null,
                    document_date,
                    due_date || null,
                    currency,
                    country_code || null,
                    net_amount ?? null,
                    vat_amount ?? null,
                    vat_rate ?? null,
                    gross_amount,
                    finalPaidAmount,
                    fx_rate ?? null,
                    fx_date || null,
                    fx_source || null,
                    gross_amount_sek,
                    paid_amount_sek,
                    vat_amount_sek ?? null,
                    is_reverse_charge,
                    is_vat_deductible,
                    category_id,
                    payment_method,
                    coverage_state,
                    notes || null,
                    status,
                    created_by || null,
                    spam
                ]
            );


            return res.status(201).json({
                success: true,
                expense: result.rows[0]
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
    // UPDATE EXPENSE
    // ============================================================

    async updateExpense(req, res) {

        const { expenseid } = req.params;

        const {
            project_id,
            vendor_id,
            vendor_name,
            document_type,
            document_number,
            document_date,
            due_date,
            currency,
            country_code,
            net_amount,
            vat_amount,
            vat_rate,
            gross_amount,
            paid_amount,
            fx_rate,
            fx_date,
            fx_source,
            gross_amount_sek,
            paid_amount_sek,
            vat_amount_sek,
            is_reverse_charge,
            is_vat_deductible,
            category_id,
            payment_method,
            coverage_state,
            notes,
            status,
            spam
        } = req.body;


        try {

            // ====================================================
            // VALIDATE ENUMS
            // ====================================================

            if (
                document_type !== undefined &&
                !VALID_DOCUMENT_TYPES.includes(document_type)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid document_type"
                });
            }


            if (
                fx_source !== undefined &&
                fx_source !== null &&
                !VALID_FX_SOURCES.includes(fx_source)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid fx_source"
                });
            }


            if (
                payment_method !== undefined &&
                !VALID_PAYMENT_METHODS.includes(payment_method)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid payment_method"
                });
            }


            if (
                coverage_state !== undefined &&
                !VALID_COVERAGE_STATES.includes(coverage_state)
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid coverage_state"
                });
            }


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
            // SPAM VALIDATION
            // ====================================================

            if (
                spam !== undefined &&
                typeof spam !== "boolean"
            ) {

                return res.status(400).json({
                    success: false,
                    error: "spam must be a boolean"
                });
            }


            // ====================================================
            // AMOUNT VALIDATION
            // ====================================================

            if (
                gross_amount !== undefined &&
                Number(gross_amount) <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    error: "gross_amount must be greater than 0"
                });
            }


            // ====================================================
            // UPDATE
            // ====================================================

            const result = await db.query(
                `UPDATE expenses
                 SET
                    project_id = COALESCE($1, project_id),
                    vendor_id = COALESCE($2, vendor_id),
                    vendor_name = COALESCE($3, vendor_name),
                    document_type = COALESCE($4, document_type),
                    document_number = COALESCE($5, document_number),
                    document_date = COALESCE($6, document_date),
                    due_date = COALESCE($7, due_date),
                    currency = COALESCE($8, currency),
                    country_code = COALESCE($9, country_code),
                    net_amount = COALESCE($10, net_amount),
                    vat_amount = COALESCE($11, vat_amount),
                    vat_rate = COALESCE($12, vat_rate),
                    gross_amount = COALESCE($13, gross_amount),
                    paid_amount = COALESCE($14, paid_amount),
                    fx_rate = COALESCE($15, fx_rate),
                    fx_date = COALESCE($16, fx_date),
                    fx_source = COALESCE($17, fx_source),
                    gross_amount_sek = COALESCE($18, gross_amount_sek),
                    paid_amount_sek = COALESCE($19, paid_amount_sek),
                    vat_amount_sek = COALESCE($20, vat_amount_sek),
                    is_reverse_charge = COALESCE($21, is_reverse_charge),
                    is_vat_deductible = COALESCE($22, is_vat_deductible),
                    category_id = COALESCE($23, category_id),
                    payment_method = COALESCE($24, payment_method),
                    coverage_state = COALESCE($25, coverage_state),
                    notes = COALESCE($26, notes),
                    status = COALESCE($27, status),
                    spam = COALESCE($28, spam),
                    updated_at = NOW()
                 WHERE id = $29
                   AND deleted_at IS NULL
                 RETURNING *`,
                [
                    project_id ?? null,
                    vendor_id ?? null,
                    vendor_name ?? null,
                    document_type ?? null,
                    document_number ?? null,
                    document_date ?? null,
                    due_date ?? null,
                    currency ?? null,
                    country_code ?? null,
                    net_amount ?? null,
                    vat_amount ?? null,
                    vat_rate ?? null,
                    gross_amount ?? null,
                    paid_amount ?? null,
                    fx_rate ?? null,
                    fx_date ?? null,
                    fx_source ?? null,
                    gross_amount_sek ?? null,
                    paid_amount_sek ?? null,
                    vat_amount_sek ?? null,
                    is_reverse_charge ?? null,
                    is_vat_deductible ?? null,
                    category_id ?? null,
                    payment_method ?? null,
                    coverage_state ?? null,
                    notes ?? null,
                    status ?? null,
                    spam ?? null,
                    expenseid
                ]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Expense not found"
                });
            }


            return res.json({
                success: true,
                expense: result.rows[0]
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
    // APPROVE EXPENSE
    // ============================================================

    async approveExpense(req, res) {

        const { expenseid } = req.params;
        const { approved_by } = req.body;

        try {

            if (!approved_by) {

                return res.status(400).json({
                    success: false,
                    error: "approved_by is required"
                });
            }


            const result = await db.query(
                `UPDATE expenses
                 SET
                    status = 'approved',
                    approved_by = $1,
                    approved_at = NOW(),
                    updated_at = NOW()
                 WHERE id = $2
                   AND deleted_at IS NULL
                 RETURNING *`,
                [
                    approved_by,
                    expenseid
                ]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Expense not found"
                });
            }


            return res.json({
                success: true,
                expense: result.rows[0]
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
    // SOFT DELETE
    // ============================================================

    async deleteExpense(req, res) {

        const { expenseid } = req.params;

        try {

            const result = await db.query(
                `UPDATE expenses
                 SET
                    deleted_at = NOW(),
                    updated_at = NOW()
                 WHERE id = $1
                   AND deleted_at IS NULL
                 RETURNING *`,
                [expenseid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Expense not found"
                });
            }


            return res.json({
                success: true,
                deleted: true,
                expense: result.rows[0]
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
    // RESTORE EXPENSE
    // ============================================================

    async restoreExpense(req, res) {

        const { expenseid } = req.params;

        try {

            const result = await db.query(
                `UPDATE expenses
                 SET
                    deleted_at = NULL,
                    updated_at = NOW()
                 WHERE id = $1
                   AND deleted_at IS NOT NULL
                 RETURNING *`,
                [expenseid]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Deleted expense not found"
                });
            }


            return res.json({
                success: true,
                expense: result.rows[0]
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
    expenseController
};