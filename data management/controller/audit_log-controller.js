const { dbConnection } = require("../../db_connection")

exports.audit_logController = {
    async getAudit_logs(req, res) {
        const db = require("../../db_connection");

        const {
            search = "",
            user = "",
            action = "",
            entity_type = "",
            dateFrom = "",
            dateTo = ""
        } = req.query;

        const conditions = [];
        const values = [];

        // Search
        if (search) {
            values.push(`%${search.toLowerCase()}%`);
            const param = `$${values.length}`;

            conditions.push(`
            (
                LOWER(a.id::text) LIKE ${param}
                OR LOWER(a.entity_type) LIKE ${param}
                OR LOWER(a.action) LIKE ${param}
                OR LOWER(COALESCE(u.username, '')) LIKE ${param}
            )
        `);
        }

        // User
        if (user) {
            values.push(user);

            conditions.push(
                `LOWER(a.user_id::text) = LOWER($${values.length})`
            );
        }

        // Entity type
        if (entity_type) {
            values.push(entity_type.toLowerCase());

            conditions.push(
                `LOWER(a.entity_type) = $${values.length}`
            );
        }

        // Action
        if (action) {
            const actionValue = action.toLowerCase();

            if (actionValue === "restore") {
                conditions.push(`
                LOWER(a.action) = 'restore'
            `);

            } else if (actionValue === "hard_delete") {
                conditions.push(`
                LOWER(a.action) = 'hard_delete'
            `);

            } else if (actionValue.endsWith("role changed")) {
                conditions.push(`
                LOWER(a.entity_type) = 'user'
                AND LOWER(a.action) = 'update'
            `);

            } else {
                const parts = actionValue.split(" ");
                const actionWord = parts.pop();
                const entityName = parts.join(" ");

                if (actionWord === "created") {
                    values.push(entityName);

                    conditions.push(`
                    LOWER(a.entity_type) = $${values.length}
                    AND LOWER(a.action) = 'create'
                `);

                } else if (actionWord === "deleted") {
                    values.push(entityName);

                    conditions.push(`
                    LOWER(a.entity_type) = $${values.length}
                    AND LOWER(a.action) = 'delete'
                `);

                } else if (actionWord === "updated") {
                    values.push(entityName);

                    conditions.push(`
                    LOWER(a.entity_type) = $${values.length}
                    AND LOWER(a.action) = 'update'
                `);

                } else if (actionWord === "edited") {
                    values.push(entityName);

                    conditions.push(`
                    LOWER(a.entity_type) = $${values.length}
                    AND LOWER(a.action) = 'update'
                    AND LOWER(a.entity_type) <> 'order'
                    AND LOWER(a.entity_type) <> 'user'
                `);

                } else {
                    conditions.push(`FALSE`);
                }
            }
        }

        // Date from
        if (dateFrom) {
            values.push(dateFrom);
            conditions.push(`a.created_at >= $${values.length}::timestamptz`);
        }

        if (dateTo) {
            values.push(dateTo);
            conditions.push(`a.created_at <= $${values.length}::timestamptz`);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        try {
            const result = await db.query(
                `
            SELECT
                a.*,
                u.username AS username,
                u.role AS role
            FROM audit_logs a
            LEFT JOIN users u
                ON a.user_id = u.id
            ${whereClause}
            ORDER BY a.created_at DESC
            `,
                values
            );

            res.json(result.rows);

        } catch (err) {
            console.error(err);

            res.status(500).json({
                error: err.message
            });
        }
    }, async getAudit_log(req, res) {
        const db = require("../../db_connection");
        const { auditlogid } = req.params;

        try {
            const result = await db.query(
                `SELECT *
             FROM audit_logs
             WHERE id = $1`,
                [auditlogid]
            );

            const auditLog = result.rows[0];

            if (!auditLog) {
                return res.status(404).json({
                    error: "Audit log not found"
                });
            }

            res.json(auditLog);
        } catch (err) {
            console.error(err);

            res.status(500).json({
                error: err.message
            });
        }
    }, async addAudit_log(req, res) {
        const db = require("../../db_connection");

        const {
            user_id,
            action,
            entity_type,
            entity_id,
            before,
            after,
            ip_address
        } = req.body;

        try {
            const result = await db.query(
                `INSERT INTO audit_logs (
                user_id,
                action,
                entity_type,
                entity_id,
                before,
                after,
                ip_address
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
                [
                    user_id,
                    action,
                    entity_type,
                    entity_id,
                    before,
                    after,
                    ip_address
                ]
            );

            res.status(201).json({
                success: true,
                auditLog: result.rows[0]
            });
        } catch (err) {
            console.error(err);

            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }, async updateAudit_log(req, res) {
        const db = require("../../db_connection");
        const { auditlogid } = req.params;

        const {
            user_id,
            action,
            entity_type,
            entity_id,
            before,
            after,
            ip_address
        } = req.body;

        try {
            const result = await db.query(
                `UPDATE audit_logs
             SET
                user_id = $1,
                action = $2,
                entity_type = $3,
                entity_id = $4,
                before = $5,
                after = $6,
                ip_address = $7
             WHERE id = $8
             RETURNING *`,
                [
                    user_id,
                    action,
                    entity_type,
                    entity_id,
                    before,
                    after,
                    ip_address,
                    auditlogid
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Audit log not found"
                });
            }

            return res.status(200).json({
                success: true,
                auditLog: result.rows[0]
            });
        } catch (err) {
            console.error(err);

            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }, async deleteAudit_log(req, res) {
        const db = require("../../db_connection");
        const { auditlogid } = req.params;

        try {
            const result = await db.query(
                `DELETE FROM audit_logs
             WHERE id = $1
             RETURNING *`,
                [auditlogid]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Audit log not found"
                });
            }

            return res.status(200).json({
                success: true,
                deletedAuditLog: true,
                auditLog: result.rows[0]
            });
        } catch (err) {
            console.error(err);

            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }
}