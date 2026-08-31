const db = require("../../db_connection");
const argon2 = require("argon2");

const VALID_ROLES = [
  "owner",
  "manager",
  "viewer"
];

exports.userController = {

  // ============================================================
  // CHECK MANAGER / OWNER PERMISSION
  // ============================================================

  async checkManagerPermission(user_id) {

    if (!user_id) {
      return {
        authorized: false,
        status: 401,
        error: "Unauthorized: user_id is required"
      };
    }

    const result = await db.query(
      `
      SELECT
        id,
        role,
        is_active
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [user_id]
    );

    if (result.rows.length === 0) {
      return {
        authorized: false,
        status: 401,
        error: "Unauthorized: user not found"
      };
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return {
        authorized: false,
        status: 403,
        error: "Unauthorized: user account is inactive"
      };
    }

    if (
      user.role !== "manager" &&
      user.role !== "owner"
    ) {
      return {
        authorized: false,
        status: 403,
        error: "Forbidden: insufficient permissions"
      };
    }

    return {
      authorized: true,
      user
    };
  },


  // ============================================================
  // CHECK OWNER PERMISSION
  // ============================================================

  async checkOwnerPermission(user_id) {

    if (!user_id) {
      return {
        authorized: false,
        status: 401,
        error: "Unauthorized: user_id is required"
      };
    }

    const result = await db.query(
      `
      SELECT
        id,
        role,
        is_active
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [user_id]
    );

    if (result.rows.length === 0) {
      return {
        authorized: false,
        status: 401,
        error: "Unauthorized: user not found"
      };
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return {
        authorized: false,
        status: 403,
        error: "Unauthorized: user account is inactive"
      };
    }

    if (user.role !== "owner") {
      return {
        authorized: false,
        status: 403,
        error: "Forbidden: only owners can perform this action"
      };
    }

    return {
      authorized: true,
      user
    };
  },


  // ============================================================
  // GET ALL USERS
  //
  // Manager / Owner only.
  // Viewers cannot access the user management page.
  // ============================================================

  async getUsers(req, res) {

    try {

      const {
        spam,
        is_active,
        user_id
      } = req.query;


      // ==========================================================
      // CHECK PERMISSION
      // ==========================================================

      const permission =
        await this.checkManagerPermission(user_id);

      if (!permission.authorized) {

        return res.status(permission.status).json({
          success: false,
          error: permission.error
        });
      }


      // ==========================================================
      // FILTERS
      // ==========================================================

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


      // ==========================================================
      // QUERY
      // ==========================================================

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
  //
  // Manager / Owner only.
  // ============================================================

  async getUser(req, res) {

    const { userid } = req.params;
    const { user_id } = req.query;


    try {

      // ==========================================================
      // CHECK PERMISSION
      // ==========================================================

      const permission =
        await this.checkManagerPermission(user_id);

      if (!permission.authorized) {

        return res.status(permission.status).json({
          success: false,
          error: permission.error
        });
      }


      // ==========================================================
      // GET USER
      // ==========================================================

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
  // Manager / Owner can create:
  // - manager
  // - viewer
  //
  // Owner cannot be created through this endpoint.
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

      // ==========================================================
      // CHECK PERMISSION
      // ==========================================================

      const permission =
        await this.checkManagerPermission(user_id);

      if (!permission.authorized) {

        return res.status(permission.status).json({
          success: false,
          error: permission.error
        });
      }


      // ==========================================================
      // REQUIRED FIELDS
      // ==========================================================

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


      // ==========================================================
      // NORMALIZE ROLE
      // ==========================================================

      const normalizedRole =
        String(role)
          .trim()
          .toLowerCase();


      // ==========================================================
      // OWNER CANNOT BE CREATED
      // ==========================================================

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


      if (!allowedRoles.includes(normalizedRole)) {

        return res.status(400).json({
          success: false,
          error:
            `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`
        });
      }


      // ==========================================================
      // PASSWORD HASH
      // ==========================================================

      const passwordHash =
        await argon2.hash(password);


      // ==========================================================
      // INSERT
      // ==========================================================

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
  //
  // This is authentication, not user management.
  // No manager/owner permission check here.
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


      const user =
        result.rows[0];


      // ==========================================================
      // VERIFY PASSWORD
      // ==========================================================

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


      // ==========================================================
      // CHECK ACTIVE
      // ==========================================================

      if (!user.is_active) {

        return res.status(403).json({
          success: false,
          error:
            "This account has been deactivated"
        });
      }


      // ==========================================================
      // CHECK INVITATION
      // ==========================================================

      if (!user.accepted_at) {

        return res.status(403).json({
          success: false,
          error:
            "Invitation has not been accepted yet"
        });
      }


      // ==========================================================
      // RECORD LOGIN
      // ==========================================================

      await db.query(
        `
        UPDATE users
        SET last_login_at = now()
        WHERE id = $1
        `,
        [user.id]
      );


      user.last_login_at =
        new Date();


      // Never expose password hash

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
  //
  // This is part of the invitation flow.
  // No manager/owner permission check.
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
  //
  // Manager:
  // - email
  // - full_name
  // - is_active
  //
  // Owner:
  // - email
  // - full_name
  // - role
  // - is_active
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

      // ==========================================================
      // CHECK MANAGER / OWNER
      // ==========================================================

      const permission =
        await this.checkManagerPermission(user_id);

      if (!permission.authorized) {

        return res.status(permission.status).json({
          success: false,
          error: permission.error
        });
      }


      const requester =
        permission.user;


      // ==========================================================
      // VALIDATE ROLE
      // ==========================================================

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


      // ==========================================================
      // ONLY OWNER CAN CHANGE ROLE
      // ==========================================================

      if (
        role !== undefined &&
        requester.role !== "owner"
      ) {

        return res.status(403).json({
          success: false,
          error:
            "Forbidden: only owners can change user roles"
        });
      }


      // ==========================================================
      // ONLY BOOLEAN FOR ACTIVE
      // ==========================================================

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


      // ==========================================================
      // CHECK TARGET USER
      // ==========================================================

      const existing =
        await db.query(
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


      // ==========================================================
      // PREVENT MANAGER FROM MODIFYING OWNER
      // ==========================================================

      if (
        requester.role !== "owner" &&
        existing.rows[0].role === "owner"
      ) {

        return res.status(403).json({
          success: false,
          error:
            "Forbidden: managers cannot modify an owner"
        });
      }


      // ==========================================================
      // UPDATE
      // ==========================================================

      const result =
        await db.query(
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
  //
  // OWNER ONLY
  //
  // Replaces DELETE.
  // ============================================================

  async deleteUser(req, res) {

    const { userid } = req.params;
    const {
      requester_id
    } = req.body || {};


    try {

      // ==========================================================
      // OWNER CHECK
      // ==========================================================

      const permission =
        await this.checkOwnerPermission(
          requester_id
        );


      if (!permission.authorized) {

        return res.status(permission.status).json({
          success: false,
          error: permission.error
        });
      }


      // ==========================================================
      // PREVENT SELF-DEACTIVATION
      // ==========================================================

      if (
        String(requester_id) ===
        String(userid)
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Cannot deactivate your own account"
        });
      }


      // ==========================================================
      // DEACTIVATE
      // ==========================================================

      const result =
        await db.query(
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
  //
  // OWNER ONLY
  // ============================================================

  async reactivateUser(req, res) {

    const { userid } = req.params;

    const {
      requester_id
    } = req.body || {};


    try {

      // ==========================================================
      // OWNER CHECK
      // ==========================================================

      const permission =
        await this.checkOwnerPermission(
          requester_id
        );


      if (!permission.authorized) {

        return res.status(permission.status).json({
          success: false,
          error: permission.error
        });
      }


      // ==========================================================
      // REACTIVATE
      // ==========================================================

      const result =
        await db.query(
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