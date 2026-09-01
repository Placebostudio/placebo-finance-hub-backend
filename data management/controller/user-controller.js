const db = require("../../db_connection");
const argon2 = require("argon2");

const VALID_ROLES = [
  "owner",
  "manager",
  "viewer"
];

exports.userController = {

  // ============================================================
  // GET ALL USERS
  // ============================================================

  async getUsers(req, res) {
    try {

      const {
        spam,
        is_active
      } = req.query;


      const conditions = [];
      const values = [];


      if (
        spam === "true" ||
        spam === "false"
      ) {

        values.push(
          spam === "true"
        );

        conditions.push(
          `spam = $${values.length}`
        );
      }


      if (
        is_active === "true" ||
        is_active === "false"
      ) {

        values.push(
          is_active === "true"
        );

        conditions.push(
          `is_active = $${values.length}`
        );
      }


      const whereClause =
        conditions.length > 0
          ? `WHERE ${conditions.join(" AND ")}`
          : "";


      const result = await db.query(
        `
      SELECT
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        invited_by,
        invited_at,
        accepted_at,
        last_login_at,
        created_at,
        spam
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      `,
        values
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
  // GET ONE USER
  // ============================================================

  async getUser(req, res) {

    const { userid } = req.params;
    const { user_id } = req.query;

    try {

      const userResult = await db.query(
        `
                SELECT
                    role,
                    is_active
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

      const requester = userResult.rows[0];

      if (!requester.is_active) {

        return res.status(403).json({
          success: false,
          error: "User account is inactive"
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

      const result = await db.query(
        `
                SELECT
                    id,
                    username,
                    email,
                    full_name,
                    role,
                    is_active,
                    invited_by,
                    invited_at,
                    accepted_at,
                    last_login_at,
                    created_at,
                    spam
                FROM users
                WHERE id = $1
                `,
        [userid]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error: "User not found"
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
  // ADD / INVITE USER
  // ============================================================

  async addUser(req, res) {

    const {
      email,
      username,
      full_name,
      password,
      role = "viewer",
      invited_by = null,
      user_id
    } = req.body;

    try {

      const userResult = await db.query(
        `
                SELECT
                    role,
                    is_active
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

      const requester = userResult.rows[0];

      if (!requester.is_active) {

        return res.status(403).json({
          success: false,
          error: "User account is inactive"
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

      if (
        !email ||
        !username ||
        !full_name ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          error:
            "email, username, full_name and password are required"
        });
      }

      const normalizedRole =
        String(role)
          .trim()
          .toLowerCase();

      if (normalizedRole === "owner") {

        return res.status(403).json({
          success: false,
          error:
            "Owner users cannot be created through this endpoint"
        });
      }

      const allowedRoles = [
        "manager",
        "viewer"
      ];

      if (
        !allowedRoles.includes(
          normalizedRole
        )
      ) {

        return res.status(400).json({
          success: false,
          error:
            `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`
        });
      }

      const passwordHash =
        await argon2.hash(password);

      const result = await db.query(
        `
                INSERT INTO public.users (
                    email,
                    username,
                    full_name,
                    password,
                    role,
                    is_active,
                    invited_by,
                    invited_at,
                    accepted_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    false,
                    $6,
                    now(),
                    NULL
                )
                RETURNING
                    id,
                    email,
                    username,
                    full_name,
                    role,
                    is_active,
                    invited_by,
                    invited_at,
                    accepted_at,
                    last_login_at,
                    created_at
                `,
        [
          email.trim(),
          username.trim(),
          full_name.trim(),
          passwordHash,
          normalizedRole,
          invited_by || null
        ]
      );

      return res.status(201).json({
        success: true,
        user: result.rows[0]
      });

    } catch (err) {

      console.error(
        "Failed to create user:",
        err
      );

      if (err.code === "23505") {

        return res.status(409).json({
          success: false,
          error:
            "A user with this email or username already exists"
        });
      }

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to create user"
      });
    }
  },


  // ============================================================
  // LOGIN
  // ============================================================

  async login(req, res) {

    const {
      username,
      password
    } = req.body;

    try {

      if (
        !username ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          error:
            "username and password are required"
        });
      }

      const result = await db.query(
        `
                SELECT
                    id,
                    username,
                    email,
                    full_name,
                    role,
                    is_active,
                    invited_by,
                    invited_at,
                    accepted_at,
                    last_login_at,
                    created_at,
                    password
                FROM users
                WHERE username = $1
                LIMIT 1
                `,
        [username]
      );

      if (result.rows.length === 0) {

        return res.status(401).json({
          success: false,
          error:
            "Invalid username or password"
        });
      }

      const user = result.rows[0];

      const passwordValid =
        await argon2.verify(
          user.password,
          password
        );

      if (!passwordValid) {

        return res.status(401).json({
          success: false,
          error:
            "Invalid username or password"
        });
      }

      if (!user.is_active) {

        return res.status(403).json({
          success: false,
          error:
            "This account has been deactivated"
        });
      }

      if (!user.accepted_at) {

        return res.status(403).json({
          success: false,
          error:
            "Invitation has not been accepted yet"
        });
      }

      await db.query(
        `
                UPDATE users
                SET last_login_at = now()
                WHERE id = $1
                `,
        [user.id]
      );

      user.last_login_at = new Date();

      delete user.password;

      return res.json({
        success: true,
        user
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
  // ACCEPT INVITATION
  // ============================================================

  async acceptInvitation(req, res) {

    const { userid } = req.params;

    try {

      const result = await db.query(
        `
                UPDATE users
                SET
                    accepted_at =
                        COALESCE(
                            accepted_at,
                            now()
                        )
                WHERE id = $1
                RETURNING
                    id,
                    email,
                    full_name,
                    role,
                    is_active,
                    invited_by,
                    invited_at,
                    accepted_at,
                    last_login_at,
                    created_at
                `,
        [userid]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error:
            "User not found"
        });
      }

      return res.status(200).json({
        success: true,
        user: result.rows[0]
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
  // UPDATE USER
  // ============================================================

  async updateUser(req, res) {

    const { userid } = req.params;

    const {
      email,
      full_name,
      role,
      is_active,
      user_id
    } = req.body;

    try {

      const userResult = await db.query(
        `
                SELECT
                    role,
                    is_active
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

      const requester = userResult.rows[0];

      if (!requester.is_active) {

        return res.status(403).json({
          success: false,
          error:
            "User account is inactive"
        });
      }

      if (
        requester.role !== "manager" &&
        requester.role !== "owner"
      ) {

        return res.status(403).json({
          success: false,
          error:
            "Insufficient permissions"
        });
      }

      if (
        role !== undefined &&
        !VALID_ROLES.includes(role)
      ) {

        return res.status(400).json({
          success: false,
          error:
            `Invalid role. Allowed roles: ${VALID_ROLES.join(", ")}`
        });
      }

      if (
        role !== undefined &&
        requester.role !== "owner"
      ) {

        return res.status(403).json({
          success: false,
          error:
            "Only owners can change user roles"
        });
      }

      if (
        is_active !== undefined &&
        typeof is_active !== "boolean"
      ) {

        return res.status(400).json({
          success: false,
          error:
            "is_active must be true or false"
        });
      }

      const existing = await db.query(
        `
                SELECT
                    id,
                    role,
                    is_active
                FROM users
                WHERE id = $1
                `,
        [userid]
      );

      if (existing.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error:
            "User not found"
        });
      }

      if (
        requester.role !== "owner" &&
        existing.rows[0].role === "owner"
      ) {

        return res.status(403).json({
          success: false,
          error:
            "Managers cannot modify an owner"
        });
      }

      const result = await db.query(
        `
                UPDATE users
                SET
                    email =
                        COALESCE(
                            $1,
                            email
                        ),

                    full_name =
                        COALESCE(
                            $2,
                            full_name
                        ),

                    role =
                        COALESCE(
                            $3,
                            role
                        ),

                    is_active =
                        COALESCE(
                            $4,
                            is_active
                        )

                WHERE id = $5

                RETURNING
                    id,
                    email,
                    full_name,
                    role,
                    is_active,
                    invited_by,
                    invited_at,
                    accepted_at,
                    last_login_at,
                    created_at
                `,
        [
          email ?? null,
          full_name ?? null,
          role ?? null,
          is_active ?? null,
          userid
        ]
      );

      return res.status(200).json({
        success: true,
        user: result.rows[0]
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
  // DEACTIVATE USER
  // ============================================================

  async deleteUser(req, res) {

    const { userid } = req.params;

    const {
      user_id
    } = req.body || {};

    try {

      const userResult = await db.query(
        `
                SELECT
                    role,
                    is_active
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
        [user_id]
      );

      if (userResult.rows.length === 0) {

        return res.status(401).json({
          success: false,
          error:
            "User not found"
        });
      }

      const requester = userResult.rows[0];

      if (!requester.is_active) {

        return res.status(403).json({
          success: false,
          error:
            "User account is inactive"
        });
      }

      if (
        requester.role !== "owner"
      ) {

        return res.status(403).json({
          success: false,
          error:
            "Only owner can deactivate users"
        });
      }

      if (
        String(user_id) ===
        String(userid)
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Cannot deactivate your own account"
        });
      }

      const result = await db.query(
        `
                UPDATE users
                SET
                    is_active = false
                WHERE id = $1
                RETURNING
                    id,
                    email,
                    full_name,
                    role,
                    is_active,
                    invited_by,
                    invited_at,
                    accepted_at,
                    last_login_at,
                    created_at
                `,
        [userid]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error:
            "User not found"
        });
      }

      return res.status(200).json({
        success: true,
        deactivatedUser: true,
        user: result.rows[0]
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
  // REACTIVATE USER
  // ============================================================

  async reactivateUser(req, res) {

    const { userid } = req.params;

    const {
      user_id
    } = req.body || {};

    try {

      const userResult = await db.query(
        `
                SELECT
                    role,
                    is_active
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
        [user_id]
      );

      if (userResult.rows.length === 0) {

        return res.status(401).json({
          success: false,
          error:
            "User not found"
        });
      }

      const requester = userResult.rows[0];

      if (!requester.is_active) {

        return res.status(403).json({
          success: false,
          error:
            "User account is inactive"
        });
      }

      if (
        requester.role !== "owner"
      ) {

        return res.status(403).json({
          success: false,
          error:
            "Only owner can reactivate users"
        });
      }

      const result = await db.query(
        `
                UPDATE users
                SET
                    is_active = true
                WHERE id = $1
                RETURNING
                    id,
                    email,
                    full_name,
                    role,
                    is_active,
                    invited_by,
                    invited_at,
                    accepted_at,
                    last_login_at,
                    created_at
                `,
        [userid]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          error:
            "User not found"
        });
      }

      return res.status(200).json({
        success: true,
        user: result.rows[0]
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