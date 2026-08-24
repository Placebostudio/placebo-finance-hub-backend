const db = require("../../db_connection");

const VALID_ROLES = ["owner", "manager", "viewer"];

exports.userController = {
  // ============================================================
  // GET ALL USERS
  // ============================================================
  async getUsers(req, res) {
    try {
      const result = await db.query(
        `SELECT
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
        created_at
      FROM users
      ORDER BY created_at DESC`
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

    try {
      const result = await db.query(
        `SELECT
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
        created_at
      FROM users
      WHERE id = $1`,
        [userid]
      );

      const user = result.rows[0];

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found"
        });
      }

      return res.json(user);

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
  //
  // IMPORTANT:
  // The id must already exist in Supabase auth.users.
  // Usually Supabase Auth creates the auth user first.
  // ============================================================
  async addUser(req, res) {
    const {
      id,
      email,
      full_name,
      role = "viewer",
      invited_by
    } = req.body;

    try {
      if (!id || !email || !full_name) {
        return res.status(400).json({
          success: false,
          error: "id, email and full_name are required"
        });
      }

      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role. Allowed roles: ${VALID_ROLES.join(", ")}`
        });
      }

      const result = await db.query(
        `INSERT INTO users (
          id,
          email,
          full_name,
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
          true,
          $5,
          now(),
          NULL
        )
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
          created_at`,
        [
          id,
          email,
          full_name,
          role,
          invited_by || null
        ]
      );

      return res.status(201).json({
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
  // LOGIN / RECORD LOGIN
  //
  // Password verification is NOT done here anymore.
  // Supabase Auth should authenticate the user first.
  //
  // This endpoint receives the authenticated user's ID
  // and verifies that the application account is active.
  // ============================================================
  async login(req, res) {

    const { username, password } = req.body;

    try {

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: "username and password are required"
        });
      }

      const result = await db.query(
        `SELECT
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
        created_at
      FROM users
      WHERE username = $1
        AND password = $2
      LIMIT 1`,
        [username, password]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "Invalid username or password"
        });
      }

      const user = result.rows[0];

      // Deactivated user
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: "This account has been deactivated"
        });
      }

      // Invitation not accepted yet
      if (!user.accepted_at) {
        return res.status(403).json({
          success: false,
          error: "Invitation has not been accepted yet"
        });
      }

      await db.query(
        `UPDATE users
       SET last_login_at = now()
       WHERE id = $1`,
        [user.id]
      );

      user.last_login_at = new Date();

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
        `UPDATE users
         SET accepted_at = COALESCE(accepted_at, now())
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
           created_at`,
        [userid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found"
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
      is_active
    } = req.body;

    try {
      if (role !== undefined && !VALID_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role. Allowed roles: ${VALID_ROLES.join(", ")}`
        });
      }

      const result = await db.query(
        `UPDATE users
         SET
           email = COALESCE($1, email),
           full_name = COALESCE($2, full_name),
           role = COALESCE($3, role),
           is_active = COALESCE($4, is_active)
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
           created_at`,
        [
          email ?? null,
          full_name ?? null,
          role ?? null,
          is_active ?? null,
          userid
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found"
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
  // DEACTIVATE USER
  //
  // Replaces DELETE.
  // The row remains in the database.
  // ============================================================
  async deleteUser(req, res) {
    const { userid } = req.params;
    const { requester_id } = req.body || {};

    try {
      if (!requester_id) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: requester_id is required"
        });
      }

      const requesterResult = await db.query(
        `SELECT id, role, is_active
         FROM users
         WHERE id = $1`,
        [requester_id]
      );

      if (requesterResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: requester not found"
        });
      }

      const requester = requesterResult.rows[0];

      if (!requester.is_active) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized: requester account is inactive"
        });
      }

      if (requester.role !== "owner") {
        return res.status(403).json({
          success: false,
          error: "Forbidden: only owners can deactivate users"
        });
      }

      // Prevent self-deactivation
      if (String(requester_id) === String(userid)) {
        return res.status(400).json({
          success: false,
          error: "Cannot deactivate your own account"
        });
      }

      const result = await db.query(
        `UPDATE users
         SET is_active = false
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
           created_at`,
        [userid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found"
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

    try {
      const result = await db.query(
        `UPDATE users
         SET is_active = true
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
           created_at`,
        [userid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found"
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