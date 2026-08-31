const db = require("../../db_connection");


const VALID_MATCH_TYPES = [
    "strong_candidate",
    "possible_candidate",
    "manual"
];

const VALID_STATUSES = [
    "confirmed",
    "rejected"
];


// ============================================================
// GET USER ROLE
// ============================================================

async function getUserRole(userId) {

    if (!userId) {
        return null;
    }

    const result = await db.query(
        `
        SELECT role
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].role;
}


// ============================================================
// CHECK ROLE
// ============================================================

function hasRole(userRole, allowedRoles) {

    return allowedRoles.includes(userRole);
}


const matchController = {

    // ============================================================
    // GET ALL MATCHES
    // ============================================================

    async getMatches(req, res) {

        try {

            const {
                status,
                spam,
                user_id
            } = req.query;


            // ====================================================
            // CHECK USER
            // ====================================================

            const userRole =
                await getUserRole(user_id);


            if (!userRole) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            // ====================================================
            // VIEWER / MANAGER / OWNER CAN VIEW
            // ====================================================

            if (
                !hasRole(
                    userRole,
                    [
                        "viewer",
                        "manager",
                        "owner"
                    ]
                )
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            let query = `
                SELECT *
                FROM matches
                WHERE 1 = 1
            `;

            const params = [];


            if (status) {

                params.push(status);

                query += `
                    AND status = $${params.length}
                `;
            }


            if (spam !== undefined) {

                params.push(
                    spam === "true"
                );

                query += `
                    AND spam = $${params.length}
                `;
            }


            query += `
                ORDER BY created_at DESC
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
    // GET ONE MATCH
    // ============================================================

    async getMatch(req, res) {

        const {
            matchid
        } = req.params;

        const {
            user_id
        } = req.query;


        try {

            // ====================================================
            // CHECK USER
            // ====================================================

            const userRole =
                await getUserRole(user_id);


            if (!userRole) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            // ====================================================
            // VIEWER / MANAGER / OWNER CAN VIEW
            // ====================================================

            if (
                !hasRole(
                    userRole,
                    [
                        "viewer",
                        "manager",
                        "owner"
                    ]
                )
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            const result =
                await db.query(
                    `
                    SELECT *
                    FROM matches
                    WHERE id = $1
                    `,
                    [matchid]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Match not found"
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
    // GET MATCHES FOR EXPENSE
    // ============================================================

    async getMatchesByExpense(req, res) {

        const {
            expenseid
        } = req.params;

        const {
            user_id
        } = req.query;


        try {

            // ====================================================
            // CHECK USER
            // ====================================================

            const userRole =
                await getUserRole(user_id);


            if (!userRole) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            // ====================================================
            // VIEWER / MANAGER / OWNER CAN VIEW
            // ====================================================

            if (
                !hasRole(
                    userRole,
                    [
                        "viewer",
                        "manager",
                        "owner"
                    ]
                )
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            const result =
                await db.query(
                    `
                    SELECT *
                    FROM matches
                    WHERE expense_id = $1
                    ORDER BY created_at DESC
                    `,
                    [expenseid]
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
    // GET MATCHES FOR TRANSACTION
    // ============================================================

    async getMatchesByTransaction(req, res) {

        const {
            transactionid
        } = req.params;

        const {
            user_id
        } = req.query;


        try {

            // ====================================================
            // CHECK USER
            // ====================================================

            const userRole =
                await getUserRole(user_id);


            if (!userRole) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            // ====================================================
            // VIEWER / MANAGER / OWNER CAN VIEW
            // ====================================================

            if (
                !hasRole(
                    userRole,
                    [
                        "viewer",
                        "manager",
                        "owner"
                    ]
                )
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            const result =
                await db.query(
                    `
                    SELECT *
                    FROM matches
                    WHERE transaction_id = $1
                    ORDER BY created_at DESC
                    `,
                    [transactionid]
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
    // ADD MATCH
    // ============================================================

    async addMatch(req, res) {

        const {
            expense_id,
            transaction_id,
            allocated_amount,
            score,
            match_type,
            reasons = [],
            status = "confirmed",
            confirmed_by,
            spam = false,
            user_id
        } = req.body;


        try {

            // ====================================================
            // CHECK USER ROLE
            // ====================================================

            const userRole =
                await getUserRole(user_id);


            if (!userRole) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            // ====================================================
            // MANAGER / OWNER CAN CREATE
            // ====================================================

            if (
                !hasRole(
                    userRole,
                    [
                        "manager",
                        "owner"
                    ]
                )
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ====================================================
            // REQUIRED FIELDS
            // ====================================================

            if (
                !expense_id ||
                !transaction_id ||
                allocated_amount === undefined ||
                allocated_amount === null ||
                !match_type ||
                !status
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "expense_id, transaction_id, " +
                        "allocated_amount, match_type and status " +
                        "are required"
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
                    error: "spam must be true or false"
                });
            }


            // ====================================================
            // VALIDATE AMOUNT
            // ====================================================

            if (
                Number(allocated_amount) <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "allocated_amount must be greater than 0"
                });
            }


            // ====================================================
            // VALIDATE SCORE
            // ============================================================

            if (
                score !== undefined &&
                score !== null &&
                (
                    Number(score) < 0 ||
                    Number(score) > 100 ||
                    !Number.isInteger(
                        Number(score)
                    )
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "score must be an integer between 0 and 100"
                });
            }


            // ====================================================
            // VALIDATE MATCH TYPE
            // ============================================================

            if (
                !VALID_MATCH_TYPES.includes(
                    match_type
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid match_type. Allowed values: " +
                        VALID_MATCH_TYPES.join(", ")
                });
            }


            // ====================================================
            // VALIDATE STATUS
            // ============================================================

            if (
                !VALID_STATUSES.includes(
                    status
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid status. Allowed values: " +
                        VALID_STATUSES.join(", ")
                });
            }


            // ====================================================
            // CHECK EXPENSE
            // ====================================================

            const expenseResult =
                await db.query(
                    `
                    SELECT
                        id,
                        gross_amount_sek,
                        coverage_state
                    FROM expenses
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [expense_id]
                );


            if (
                expenseResult.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    error: "Expense not found"
                });
            }


            const expense =
                expenseResult.rows[0];


            // ====================================================
            // CHECK TRANSACTION
            // ====================================================

            const transactionResult =
                await db.query(
                    `
                    SELECT
                        id,
                        billed_amount,
                        coverage_state
                    FROM transactions
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [transaction_id]
                );


            if (
                transactionResult.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    error: "Transaction not found"
                });
            }


            const transaction =
                transactionResult.rows[0];


            // ====================================================
            // CHECK PAIR ALREADY EXISTS
            // ====================================================

            const existingPair =
                await db.query(
                    `
                    SELECT
                        id,
                        status
                    FROM matches
                    WHERE expense_id = $1
                    AND transaction_id = $2
                    LIMIT 1
                    `,
                    [
                        expense_id,
                        transaction_id
                    ]
                );


            if (
                existingPair.rows.length > 0
            ) {

                return res.status(409).json({
                    success: false,
                    error:
                        "This expense and transaction pair already exists",
                    match:
                        existingPair.rows[0]
                });
            }


            // ====================================================
            // CHECK EXPENSE ALLOCATION
            // ====================================================

            const expenseAllocation =
                await db.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(allocated_amount),
                            0
                        ) AS allocated
                    FROM matches
                    WHERE expense_id = $1
                    AND status = 'confirmed'
                    `,
                    [expense_id]
                );


            const currentExpenseAllocation =
                Number(
                    expenseAllocation
                        .rows[0]
                        .allocated
                );


            const expenseLimit =
                Number(
                    expense.gross_amount_sek
                );


            if (
                currentExpenseAllocation +
                Number(allocated_amount)
                >
                expenseLimit + 0.01
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Allocation exceeds the expense gross amount",
                    allocated:
                        currentExpenseAllocation,
                    requested:
                        Number(allocated_amount),
                    limit:
                        expenseLimit
                });
            }


            // ====================================================
            // CHECK TRANSACTION ALLOCATION
            // ====================================================

            const transactionAllocation =
                await db.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(allocated_amount),
                            0
                        ) AS allocated
                    FROM matches
                    WHERE transaction_id = $1
                    AND status = 'confirmed'
                    `,
                    [transaction_id]
                );


            const currentTransactionAllocation =
                Number(
                    transactionAllocation
                        .rows[0]
                        .allocated
                );


            const transactionLimit =
                Math.abs(
                    Number(
                        transaction.billed_amount
                    )
                );


            if (
                currentTransactionAllocation +
                Number(allocated_amount)
                >
                transactionLimit + 0.01
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Allocation exceeds the transaction billed amount",
                    allocated:
                        currentTransactionAllocation,
                    requested:
                        Number(allocated_amount),
                    limit:
                        transactionLimit
                });
            }


            // ====================================================
            // INSERT
            // ====================================================

            const result =
                await db.query(
                    `
                    INSERT INTO matches (
                        expense_id,
                        transaction_id,
                        allocated_amount,
                        score,
                        match_type,
                        reasons,
                        status,
                        confirmed_by,
                        confirmed_at,
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
                        CASE
                            WHEN $7 = 'confirmed'
                            THEN NOW()
                            ELSE NULL
                        END,
                        $9
                    )
                    RETURNING *
                    `,
                    [
                        expense_id,
                        transaction_id,
                        allocated_amount,
                        score ?? null,
                        match_type,
                        JSON.stringify(reasons),
                        status,
                        confirmed_by || null,
                        spam
                    ]
                );


            return res.status(201).json({
                success: true,
                match: result.rows[0]
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
    // UPDATE MATCH
    // ============================================================

    async updateMatch(req, res) {

        const {
            matchid
        } = req.params;

        const {
            allocated_amount,
            score,
            match_type,
            reasons,
            status,
            confirmed_by,
            spam,
            user_id
        } = req.body;


        try {

            // ====================================================
            // CHECK USER ROLE
            // ====================================================

            const userRole =
                await getUserRole(user_id);


            if (!userRole) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            // ====================================================
            // MANAGER / OWNER CAN UPDATE
            // ====================================================

            if (
                !hasRole(
                    userRole,
                    [
                        "manager",
                        "owner"
                    ]
                )
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ====================================================
            // CHECK MATCH EXISTS
            // ====================================================

            const existing =
                await db.query(
                    `
                    SELECT *
                    FROM matches
                    WHERE id = $1
                    `,
                    [matchid]
                );


            if (
                existing.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    error: "Match not found"
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
            // VALIDATE MATCH TYPE
            // ============================================================

            if (
                match_type !== undefined &&
                !VALID_MATCH_TYPES.includes(
                    match_type
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid match_type"
                });
            }


            // ====================================================
            // VALIDATE STATUS
            // ============================================================

            if (
                status !== undefined &&
                !VALID_STATUSES.includes(
                    status
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid status"
                });
            }


            // ====================================================
            // VALIDATE SCORE
            // ============================================================

            if (
                score !== undefined &&
                score !== null &&
                (
                    Number(score) < 0 ||
                    Number(score) > 100 ||
                    !Number.isInteger(
                        Number(score)
                    )
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "score must be an integer between 0 and 100"
                });
            }


            // ====================================================
            // VALIDATE ALLOCATED AMOUNT
            // ====================================================

            if (
                allocated_amount !== undefined &&
                Number(allocated_amount) <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "allocated_amount must be greater than 0"
                });
            }


            // ====================================================
            // UPDATE
            // ====================================================

            const result =
                await db.query(
                    `
                    UPDATE matches
                    SET
                        allocated_amount =
                            COALESCE(
                                $1,
                                allocated_amount
                            ),

                        score =
                            COALESCE(
                                $2,
                                score
                            ),

                        match_type =
                            COALESCE(
                                $3,
                                match_type
                            ),

                        reasons =
                            COALESCE(
                                $4,
                                reasons
                            ),

                        status =
                            COALESCE(
                                $5,
                                status
                            ),

                        confirmed_by =
                            COALESCE(
                                $6,
                                confirmed_by
                            ),

                        confirmed_at =
                            CASE
                                WHEN $5 = 'confirmed'
                                THEN COALESCE(
                                    confirmed_at,
                                    NOW()
                                )
                                ELSE confirmed_at
                            END,

                        revalidated_at =
                            NOW(),

                        spam =
                            COALESCE(
                                $7,
                                spam
                            )

                    WHERE id = $8

                    RETURNING *
                    `,
                    [
                        allocated_amount ?? null,
                        score ?? null,
                        match_type ?? null,
                        reasons !== undefined
                            ? JSON.stringify(reasons)
                            : null,
                        status ?? null,
                        confirmed_by ?? null,
                        spam !== undefined
                            ? spam
                            : null,
                        matchid
                    ]
                );


            return res.json({
                success: true,
                match: result.rows[0]
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
    // DELETE MATCH
    // ============================================================

    async deleteMatch(req, res) {

        const {
            matchid
        } = req.params;

        const {
            user_id
        } = req.body;


        try {

            // ====================================================
            // CHECK USER ROLE
            // ====================================================

            const userRole =
                await getUserRole(user_id);


            if (!userRole) {

                return res.status(401).json({
                    success: false,
                    error: "User not found"
                });
            }


            // ====================================================
            // ONLY OWNER CAN PERMANENTLY DELETE
            // ====================================================

            if (
                userRole !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error:
                        "Only owner can permanently delete matches"
                });
            }


            // ====================================================
            // DELETE
            // ====================================================

            const result =
                await db.query(
                    `
                    DELETE FROM matches
                    WHERE id = $1
                    RETURNING *
                    `,
                    [matchid]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    error: "Match not found"
                });
            }


            return res.json({
                success: true,
                match: result.rows[0]
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
    matchController
};