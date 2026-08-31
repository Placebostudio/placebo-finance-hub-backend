const db = require("../../db_connection");

const audit_logController = {

    // ============================================================
    // GET ALL AUDIT LOGS
    //
    // Manager + Owner
    // Viewer has no access.
    // ============================================================

    async getAudit_logs(req, res) {

        const {
            user_id,
            search = "",
            user = "",
            action = "",
            entity_type = "",
            dateFrom = "",
            dateTo = ""
        } = req.query;

        try {

            // ====================================================
            // CHECK REQUESTER
            // ====================================================

            if (!user_id) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: user_id is required"
                });
            }

            const requesterResult = await db.query(
                `
                SELECT id, role, is_active
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [user_id]
            );

            if (requesterResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: requester not found"
                });
            }

            const requester =
                requesterResult.rows[0];

            if (!requester.is_active) {

                return res.status(403).json({
                    success: false,
                    error:
                        "Unauthorized: requester account is inactive"
                });
            }

            if (
                requester.role !== "manager" &&
                requester.role !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ====================================================
            // FILTERS
            // ====================================================

            const conditions = [];
            const values = [];


            // ----------------------------------------------------
            // SEARCH
            // ----------------------------------------------------

            if (search) {

                values.push(
                    `%${search.toLowerCase()}%`
                );

                const param =
                    `$${values.length}`;

                conditions.push(`
                    (
                        LOWER(a.id::text) LIKE ${param}
                        OR LOWER(a.entity_type) LIKE ${param}
                        OR LOWER(a.action) LIKE ${param}
                        OR LOWER(
                            COALESCE(u.username, '')
                        ) LIKE ${param}
                    )
                `);
            }


            // ----------------------------------------------------
            // USER
            // ----------------------------------------------------

            if (user) {

                values.push(user);

                conditions.push(
                    `LOWER(a.actor_id::text) =
                     LOWER($${values.length})`
                );
            }


            // ----------------------------------------------------
            // ENTITY TYPE
            // ----------------------------------------------------

            if (entity_type) {

                values.push(
                    entity_type.toLowerCase()
                );

                conditions.push(
                    `LOWER(a.entity_type) =
                     $${values.length}`
                );
            }


            // ----------------------------------------------------
            // ACTION
            // ----------------------------------------------------

            if (action) {

                const actionValue =
                    action.toLowerCase();


                if (actionValue === "restore") {

                    conditions.push(`
                        LOWER(a.action) = 'restore'
                    `);

                } else if (
                    actionValue === "hard_delete"
                ) {

                    conditions.push(`
                        LOWER(a.action) = 'hard_delete'
                    `);

                } else if (
                    actionValue.endsWith("role changed")
                ) {

                    conditions.push(`
                        LOWER(a.entity_type) = 'user'
                        AND LOWER(a.action) = 'update'
                    `);

                } else {

                    const parts =
                        actionValue.split(" ");

                    const actionWord =
                        parts.pop();

                    const entityName =
                        parts.join(" ");


                    if (actionWord === "created") {

                        values.push(entityName);

                        conditions.push(`
                            LOWER(a.entity_type) =
                                $${values.length}
                            AND LOWER(a.action) =
                                'create'
                        `);

                    } else if (
                        actionWord === "deleted"
                    ) {

                        values.push(entityName);

                        conditions.push(`
                            LOWER(a.entity_type) =
                                $${values.length}
                            AND LOWER(a.action) =
                                'delete'
                        `);

                    } else if (
                        actionWord === "updated"
                    ) {

                        values.push(entityName);

                        conditions.push(`
                            LOWER(a.entity_type) =
                                $${values.length}
                            AND LOWER(a.action) =
                                'update'
                        `);

                    } else if (
                        actionWord === "edited"
                    ) {

                        values.push(entityName);

                        conditions.push(`
                            LOWER(a.entity_type) =
                                $${values.length}
                            AND LOWER(a.action) =
                                'update'
                            AND LOWER(a.entity_type) <> 'order'
                            AND LOWER(a.entity_type) <> 'user'
                        `);

                    } else {

                        conditions.push(`FALSE`);
                    }
                }
            }


            // ----------------------------------------------------
            // DATE FROM
            // ----------------------------------------------------

            if (dateFrom) {

                values.push(dateFrom);

                conditions.push(
                    `a.created_at >=
                     $${values.length}::timestamptz`
                );
            }


            // ----------------------------------------------------
            // DATE TO
            // ----------------------------------------------------

            if (dateTo) {

                values.push(dateTo);

                conditions.push(
                    `a.created_at <=
                     $${values.length}::timestamptz`
                );
            }


            // ====================================================
            // WHERE
            // ====================================================

            const whereClause =
                conditions.length > 0
                    ? `WHERE ${conditions.join(" AND ")}`
                    : "";


            // ====================================================
            // GET
            // ====================================================

            const result = await db.query(
                `
                SELECT
                    a.*,
                    u.username AS username,
                    u.role AS role
                FROM audit_logs a
                LEFT JOIN users u
                    ON a.actor_id = u.id
                ${whereClause}
                ORDER BY a.created_at DESC
                `,
                values
            );

            return res.json(result.rows);

        } catch (err) {

            console.error(
                "Failed to get audit logs:",
                err
            );

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // GET ONE AUDIT LOG
    //
    // Manager + Owner
    // ============================================================

    async getAudit_log(req, res) {

        const {
            user_id
        } = req.query;

        const {
            auditlogid
        } = req.params;

        try {

            // ====================================================
            // CHECK REQUESTER
            // ====================================================

            if (!user_id) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: user_id is required"
                });
            }

            const requesterResult = await db.query(
                `
                SELECT id, role, is_active
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [user_id]
            );

            if (requesterResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: requester not found"
                });
            }

            const requester =
                requesterResult.rows[0];

            if (!requester.is_active) {

                return res.status(403).json({
                    success: false,
                    error:
                        "Unauthorized: requester account is inactive"
                });
            }

            if (
                requester.role !== "manager" &&
                requester.role !== "owner"
            ) {

                return res.status(403).json({
                    success: false,
                    error: "Insufficient permissions"
                });
            }


            // ====================================================
            // GET
            // ====================================================

            const result = await db.query(
                `
                SELECT
                    a.*,
                    u.username AS username,
                    u.role AS role
                FROM audit_logs a
                LEFT JOIN users u
                    ON a.actor_id = u.id
                WHERE a.id = $1
                `,
                [auditlogid]
            );

            const auditLog =
                result.rows[0];

            if (!auditLog) {

                return res.status(404).json({
                    success: false,
                    error: "Audit log not found"
                });
            }

            return res.json(auditLog);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },


    // ============================================================
    // ADD AUDIT LOG
    //
    // Owner only.
    // ============================================================

    async addAudit_log(req, res) {

        const {
            user_id,
            actor_id,
            action,
            entity_type,
            entity_id,
            before,
            after,
            ip_address
        } = req.body;

        try {

            // ====================================================
            // CHECK REQUESTER
            // ====================================================

            if (!user_id) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: user_id is required"
                });
            }

            const requesterResult = await db.query(
                `
                SELECT id, role, is_active
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [user_id]
            );

            if (requesterResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: requester not found"
                });
            }

            const requester =
                requesterResult.rows[0];

            if (!requester.is_active) {

                return res.status(403).json({
                    success: false,
                    error:
                        "Unauthorized: requester account is inactive"
                });
            }

            if (requester.role !== "owner") {

                return res.status(403).json({
                    success: false,
                    error:
                        "Forbidden: only owners can create audit logs"
                });
            }


            // ====================================================
            // REQUIRED FIELDS
            // ====================================================

            if (
                !actor_id ||
                !action ||
                !entity_type
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "actor_id, action and entity_type are required"
                });
            }


            // ====================================================
            // INSERT
            // ====================================================

            const result = await db.query(
                `
                INSERT INTO audit_logs (
                    actor_id,
                    action,
                    entity_type,
                    entity_id,
                    before,
                    after,
                    ip_address
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
                    actor_id,
                    action,
                    entity_type,
                    entity_id ?? null,
                    before ?? null,
                    after ?? null,
                    ip_address ?? null
                ]
            );

            return res.status(201).json({
                success: true,
                auditLog: result.rows[0]
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
    // UPDATE AUDIT LOG
    //
    // Owner only.
    // ============================================================

    async updateAudit_log(req, res) {

        const {
            user_id,
            actor_id,
            action,
            entity_type,
            entity_id,
            before,
            after,
            ip_address
        } = req.body;

        const {
            auditlogid
        } = req.params;

        try {

            // ====================================================
            // CHECK REQUESTER
            // ====================================================

            if (!user_id) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: user_id is required"
                });
            }

            const requesterResult = await db.query(
                `
                SELECT id, role, is_active
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [user_id]
            );

            if (requesterResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: requester not found"
                });
            }

            const requester =
                requesterResult.rows[0];

            if (!requester.is_active) {

                return res.status(403).json({
                    success: false,
                    error:
                        "Unauthorized: requester account is inactive"
                });
            }

            if (requester.role !== "owner") {

                return res.status(403).json({
                    success: false,
                    error:
                        "Forbidden: only owners can modify audit logs"
                });
            }


            // ====================================================
            // UPDATE
            // ====================================================

            const result = await db.query(
                `
                UPDATE audit_logs
                SET
                    actor_id = COALESCE($1, actor_id),
                    action = COALESCE($2, action),
                    entity_type = COALESCE($3, entity_type),
                    entity_id = COALESCE($4, entity_id),
                    before = COALESCE($5, before),
                    after = COALESCE($6, after),
                    ip_address = COALESCE($7, ip_address)
                WHERE id = $8
                RETURNING *
                `,
                [
                    actor_id ?? null,
                    action ?? null,
                    entity_type ?? null,
                    entity_id ?? null,
                    before ?? null,
                    after ?? null,
                    ip_address ?? null,
                    auditlogid
                ]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Audit log not found"
                });
            }

            return res.status(200).json({
                success: true,
                auditLog: result.rows[0]
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
    // DELETE AUDIT LOG
    //
    // Owner only.
    // ============================================================

    async deleteAudit_log(req, res) {

        const {
            user_id
        } = req.body || {};

        const {
            auditlogid
        } = req.params;

        try {

            // ====================================================
            // CHECK REQUESTER
            // ====================================================

            if (!user_id) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: user_id is required"
                });
            }

            const requesterResult = await db.query(
                `
                SELECT id, role, is_active
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [user_id]
            );

            if (requesterResult.rows.length === 0) {

                return res.status(401).json({
                    success: false,
                    error: "Unauthorized: requester not found"
                });
            }

            const requester =
                requesterResult.rows[0];

            if (!requester.is_active) {

                return res.status(403).json({
                    success: false,
                    error:
                        "Unauthorized: requester account is inactive"
                });
            }

            if (requester.role !== "owner") {

                return res.status(403).json({
                    success: false,
                    error:
                        "Forbidden: only owners can delete audit logs"
                });
            }


            // ====================================================
            // DELETE
            // ====================================================

            const result = await db.query(
                `
                DELETE FROM audit_logs
                WHERE id = $1
                RETURNING *
                `,
                [auditlogid]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Audit log not found"
                });
            }

            return res.status(200).json({
                success: true,
                deletedAuditLog: true,
                auditLog: result.rows[0]
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
    audit_logController
};