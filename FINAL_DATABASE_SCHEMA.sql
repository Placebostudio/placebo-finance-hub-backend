-- =====================================================
-- PLACEBO PLM — FINAL DATABASE SCHEMA
-- =====================================================
-- Generated:    2026-08-17
-- Source:       placebo-plm-js-backend controllers (all active)
-- Verified:     every SELECT / INSERT / UPDATE / DELETE
--               checked against the actual controller SQL
-- Purpose:      clean PostgreSQL / Supabase database creation
-- =====================================================
-- DO NOT EXECUTE without review.
-- Run on a clean Supabase PostgreSQL database only after approval.
-- =====================================================


-- =====================================================
-- 1. EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Enables gen_random_uuid() for UUID primary key generation.
-- Required on PostgreSQL < 13; safe to run on any version.


-- =====================================================
-- 2. SUPPLIERS
-- (created first — referenced by users.supplier_id and materials.supplier_id)
-- =====================================================

CREATE TABLE suppliers (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Note: addSupplier accepts id from req.body and inserts it explicitly.
    -- The DEFAULT gen_random_uuid() ensures the DB generates a UUID if the
    -- client does not supply one. Client-supplied UUIDs override the default.

    name                text        NOT NULL,
    country             text,
    contact_name        text,
    contact_email       text,
    contact_phone       text,
    website             text,
    lead_time_days      integer,
    payment_terms       text,
    notes               text,
    status              text,

    spam                boolean     NOT NULL DEFAULT false,
    -- spam: present in both INSERT (from req.body) and UPDATE (COALESCE).
    -- Serves as the soft-delete flag for suppliers.

    updated_at          timestamptz,
    -- SET to now() explicitly in updateSupplier: updated_at = now()

    created_at          timestamptz NOT NULL DEFAULT now()
    -- Not set by INSERT — relies on DB default.
);


-- =====================================================
-- 3. USERS
-- =====================================================

CREATE TABLE users (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    username        text        NOT NULL UNIQUE,
    -- Required on signup. Used in login WHERE LOWER(username) = LOWER($1).
    -- UNIQUE enforced at DB level. Case-insensitive login is handled in app code.

    email           text        NOT NULL UNIQUE,

    password_hash   text        NOT NULL,
    -- Stores Argon2id hashes. Verified with argon2.verify() on login.
    -- updateUser re-hashes a plain password if provided via the password field;
    -- the hash field is computed server-side before storage.

    name            text,

    role            text        NOT NULL DEFAULT 'viewer'
                                CHECK (role IN ('owner', 'manager', 'editor', 'viewer', 'supplier')),
    -- Active roles confirmed from requirements and addUser (hardcodes 'viewer').
    -- updateUser accepts any of these roles. CHECK constraint prevents invalid values.
    -- Stored as text to match Node.js string passing — no enum type.

    supplier_id     uuid        REFERENCES suppliers (id) ON DELETE SET NULL,
    -- Nullable. Set to null for non-supplier users (normalizedSupplierId logic in updateUser).
    -- ON DELETE SET NULL: if the referenced supplier is deleted, the FK is cleared.

    status          text        NOT NULL DEFAULT 'active',
    -- Login blocks users where status != 'active'. Hardcoded default on addUser.

    last_login_at   timestamptz,
    -- SET to now() on successful login. NULL until first login.

    created_at      timestamptz NOT NULL DEFAULT now()
    -- Not set by INSERT — relies on DB default.
);


-- =====================================================
-- 4. MATERIALS
-- =====================================================

CREATE TABLE materials (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    name                    text        NOT NULL,
    color                   text,
    color_hex               text,
    category                text,

    supplier_id             uuid        REFERENCES suppliers (id) ON DELETE SET NULL,
    -- Used in bom_lines LEFT JOIN: LEFT JOIN suppliers s ON m.supplier_id = s.id
    -- Nullable. ON DELETE SET NULL keeps the material if the supplier is removed.

    unit_cost               numeric,
    currency                text,
    unit_of_measure         text,
    minimum_order_quantity  numeric,
    -- numeric chosen over integer: MOQ can be a fractional value (e.g. 0.5 kg).

    notes                   text,
    status                  text,

    spam                    boolean     NOT NULL DEFAULT false
    -- NOT included in addMaterial INSERT — DB default false is applied.
    -- IS included in updateMaterial allowedFields and can be set to true/false.
    -- DEFAULT false ensures INSERT never fails due to a missing NOT NULL column.

    -- No updated_at: the updateMaterial controller builds a dynamic SET clause
    -- from allowedFields and does NOT include updated_at = now(). Adding this
    -- column would leave it permanently NULL — omitted to avoid dead column.
    --
    -- No created_at: not referenced in any material query.
);


-- =====================================================
-- 5. PRODUCTS
-- =====================================================

CREATE TABLE products (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    name                text        NOT NULL,
    style_code          text,
    sku                 text,
    category            text,
    season              text,

    colors              text,
    sizes               text,
    -- Stored as text, not text[]. The backend passes colors/sizes through
    -- without any array manipulation (no array operators used).
    -- The frontend may send comma-separated strings or JSON strings; storing as
    -- text is compatible with both without requiring type conversion.

    pricing_multiplier  numeric,
    selling_price       numeric,
    currency            text,
    notes               text,
    status              text,

    spam                boolean     NOT NULL DEFAULT false,
    -- NOT in addProduct INSERT — DB default false is applied.
    -- IS in updateProduct fields list and SET on UPDATE.

    image_url           text,
    -- Nullable. addProduct passes: image_url || null

    updated_at          timestamptz
    -- SET to now() in updateProduct: updates.push("updated_at = now()")
    -- Returned via SELECT * in getProduct / getProducts.

    -- No created_at: not referenced in any product query.
);


-- =====================================================
-- 6. BOM LINES
-- =====================================================

CREATE TABLE bom_lines (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id          uuid        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    -- INNER JOIN confirmed: JOIN products p ON b.product_id = p.id
    -- ON DELETE CASCADE: BOM lines belong to a product; delete them if product is deleted.

    material_id         uuid        NOT NULL REFERENCES materials (id) ON DELETE RESTRICT,
    -- INNER JOIN confirmed: JOIN materials m ON b.material_id = m.id
    -- ON DELETE RESTRICT: prevent deleting a material that is used in a BOM line.

    quantity_per_unit   numeric,
    unit_of_measure     text,
    notes               text,

    sort_order          integer     DEFAULT 0,
    -- ORDER BY b.sort_order ASC, b.id in getBom_lines.
    -- DEFAULT 0 matches the addBom_line INSERT which passes sort_order from req.body
    -- (may be null/undefined if not provided by the client).

    updated_at          timestamptz
    -- SET to now() in updateBom_line: updated_at = now()
);


-- =====================================================
-- 7. ORDERS
-- =====================================================

CREATE TABLE orders (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    order_number            text,
    -- Filtered with ILIKE in getOrders. Not enforced UNIQUE — not constrained in code.

    name                    text,
    -- Backend accepts order_name OR name from req.body (alias support).

    status                  text,
    factory                 text,
    -- Backend accepts production_factory OR factory from req.body (alias support).

    shipping_destination    text,

    order_date              date,
    -- ORDER BY o.order_date DESC in getOrders. Date-only field in PLM context.

    target_date             date,

    order_currency          text,

    shipping_cost           numeric     DEFAULT 0,
    -- addOrder passes: shipping_cost ?? 0

    notes                   text,

    spam                    boolean     NOT NULL DEFAULT false,
    -- Explicitly in addOrder INSERT (spam ?? false) and in updateOrder fields list.

    season                  text,
    -- Nullable: addOrder passes season ?? null

    production_country      text,
    -- Nullable: addOrder passes production_country ?? null

    destination_address     text,
    -- Nullable: addOrder passes destination_address ?? null

    updated_at              timestamptz
    -- SET to now() in updateOrder: updates.push("updated_at = now()")
    -- NOTE: the audit document incorrectly stated orders has no updated_at.
    --       The actual order-controller.js does include updated_at = now().

    -- No created_at: not referenced in any order query.
    -- order_date serves as the application-level date for ordering.
    --
    -- Columns from the audit NOT included (not found in any INSERT/UPDATE in
    -- the actual controller): shipping_cost_type, customs_cost, customs_type,
    -- cost_allocation_method. They were present in an older version.
);


-- =====================================================
-- 8. ORDER LINES
-- =====================================================

CREATE TABLE order_lines (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    -- id is often supplied by the client (req.body.id || randomUUID()).
    -- DEFAULT gen_random_uuid() is a safety fallback if the DB insert omits it,
    -- but the controller always provides an explicit id value.

    order_id    uuid    NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    -- ON DELETE CASCADE: order lines belong to the order; remove them if order deleted.

    product_id  uuid    NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    -- ON DELETE RESTRICT: prevent deleting a product that is on an order line.

    color       text,
    size        text,
    quantity    numeric,
    -- numeric rather than integer: allows fractional quantities if needed.

    destination text

    -- No timestamps: not referenced in any order_line query.
);


-- =====================================================
-- 9. ORDER ADDITIONAL COSTS
-- =====================================================

CREATE TABLE order_additional_costs (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    -- id is often supplied by the client (req.body.id || randomUUID()).

    order_id    uuid    NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    -- INNER JOIN confirmed: JOIN orders o ON oac.order_id = o.id
    -- ON DELETE CASCADE: additional costs belong to the order.

    amount      numeric,
    cost_type   text,
    -- Filtered with = in getOrder_additional_costs WHERE clause.

    currency    text,
    description text

    -- IMPORTANT: the audit document listed 'label' and 'sort_order' columns.
    -- The actual order_additional_cost-controller.js uses 'currency' and
    -- 'description' in both INSERT and UPDATE. This schema follows the
    -- actual controller code, not the audit document.
    --
    -- No timestamps: not referenced in any additional_cost query.
);


-- =====================================================
-- 10. AUDIT LOGS
-- =====================================================

CREATE TABLE audit_logs (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
    -- Nullable FK. LEFT JOIN users u ON a.user_id = u.id in getAudit_logs.
    -- ON DELETE SET NULL: keep audit history if the user is deleted.

    action      text,
    -- Values used in filter logic: 'create', 'update', 'delete',
    -- 'restore', 'hard_delete'. Stored as plain text (no enum).

    entity_type text,
    -- Values: 'user', 'product', 'material', 'order', etc.
    -- Stored as plain text; filtered with LOWER() comparison.

    entity_id   text,
    -- Stored as text: controller casts with entity_id::text for comparison.
    -- Using text allows UUID values and other ID formats without type conflicts.

    before      jsonb,
    after       jsonb,
    -- Stored as jsonb: the Node.js pg driver serializes JS objects to jsonb.
    -- jsonb supports structured state snapshots and efficient querying.
    -- The controller passes req.body.before / req.body.after directly.

    ip_address  text,

    created_at  timestamptz NOT NULL DEFAULT now()
    -- ORDER BY a.created_at DESC in getAudit_logs.
    -- Filtered with ::timestamptz comparison for dateFrom / dateTo.
);


-- =====================================================
-- 11. ATTACHMENTS
-- (attachment router is currently commented out in index.js,
--  but the controller is fully implemented. Table is included
--  so the feature can be re-enabled without a migration.)
-- =====================================================

CREATE TABLE attachments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_type     text        NOT NULL CHECK (entity_type IN ('product', 'material')),
    -- Constraint mirrors the application check in attachment-controller.js line 91.
    -- Allowed values: "product" or "material".

    entity_id       uuid        NOT NULL,
    -- POLYMORPHIC REFERENCE: refers to either products.id or materials.id
    -- depending on entity_type. PostgreSQL does not support FK to multiple tables,
    -- so no REFERENCES clause is defined here. The entity_type CHECK + application
    -- logic enforce integrity. Do NOT add a FK to a single table.

    file_name       text,
    s3_key          text,
    -- s3_key stores the Cloudinary public_id (misleading legacy name kept for
    -- backend compatibility — attachment-controller reads this field by name).

    content_type    text,
    size_bytes      integer,

    uploaded_by     uuid        REFERENCES users (id) ON DELETE SET NULL,
    -- Nullable. ON DELETE SET NULL keeps the attachment record if uploader is deleted.

    created_at      timestamptz NOT NULL DEFAULT now()
    -- ORDER BY created_at DESC in getAttachments.
);


-- =====================================================
-- 12. CURRENCY RATES
-- (getCurrencies bypasses this table and calls the Frankfurter API directly.
--  getCurrency, updateCurrencies, and deleteCurrency still use the table.)
-- =====================================================

CREATE TABLE currency_rates (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    currency                    text        NOT NULL,
    compared_to_base_currency   text        NOT NULL,

    rate                        numeric,

    last_updated                timestamptz,
    -- SET to NOW() on every upsert in updateCurrencies.

    UNIQUE (currency, compared_to_base_currency)
    -- REQUIRED: updateCurrencies uses ON CONFLICT (currency, compared_to_base_currency)
    -- DO UPDATE SET rate = EXCLUDED.rate, last_updated = NOW()
);


-- =====================================================
-- 13. INDEXES
-- =====================================================

-- Users
CREATE INDEX idx_users_username_lower ON users (LOWER(username));
-- Supports: WHERE LOWER(username) = LOWER($1) in login endpoint.

CREATE INDEX idx_users_supplier_id ON users (supplier_id);

-- Suppliers
CREATE INDEX idx_suppliers_name ON suppliers (name);
CREATE INDEX idx_suppliers_status ON suppliers (status);
CREATE INDEX idx_suppliers_spam ON suppliers (spam);

-- Materials
CREATE INDEX idx_materials_supplier_id ON materials (supplier_id);
CREATE INDEX idx_materials_name ON materials (name);
CREATE INDEX idx_materials_category ON materials (category);
CREATE INDEX idx_materials_status ON materials (status);

-- Products
CREATE INDEX idx_products_name ON products (name);
CREATE INDEX idx_products_style_code ON products (style_code);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_status ON products (status);

-- BOM Lines
CREATE INDEX idx_bom_lines_product_id ON bom_lines (product_id);
CREATE INDEX idx_bom_lines_material_id ON bom_lines (material_id);
CREATE INDEX idx_bom_lines_sort_order ON bom_lines (sort_order);

-- Orders
CREATE INDEX idx_orders_order_date ON orders (order_date DESC);
-- Supports: ORDER BY o.order_date DESC in getOrders.

CREATE INDEX idx_orders_order_number ON orders (order_number);
-- Supports: ILIKE filter on o.order_number.

CREATE INDEX idx_orders_spam ON orders (spam);

-- Order Lines
CREATE INDEX idx_order_lines_order_id ON order_lines (order_id);
CREATE INDEX idx_order_lines_product_id ON order_lines (product_id);

-- Order Additional Costs
CREATE INDEX idx_order_additional_costs_order_id ON order_additional_costs (order_id);

-- Audit Logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs (LOWER(entity_type));
CREATE INDEX idx_audit_logs_action ON audit_logs (LOWER(action));

-- Attachments
CREATE INDEX idx_attachments_entity ON attachments (entity_type, entity_id);
CREATE INDEX idx_attachments_uploaded_by ON attachments (uploaded_by);


-- =====================================================
-- 14. INITIAL OWNER USER
-- =====================================================
-- Bootstrap account for first-time login after database creation.
--
-- Credentials:
--   Username : Placebo
--   Password : password  (DO NOT store plain text — hash is stored below)
--   Role     : owner
--   Status   : active
--
-- Hash generated with: argon2.hash('password', { type: argon2.argon2id })
-- Hash verified with:  argon2.verify(hash, 'password') → true
-- Library used:        argon2 npm package (same library used by the backend)
-- =====================================================

INSERT INTO users (
    username,
    email,
    password_hash,
    name,
    role,
    status
)
VALUES (
    'Placebo',
    'placebo@local.dev',
    '$argon2id$v=19$m=65536,p=4,t=3$5Bp+QDfHGKFehPV7n4M0qA$0xVw0x4gQ5natBd0avb31AFK6MLHL07rDOwVSyuxx9s',
    'Placebo',
    'owner',
    'active'
);

-- Login endpoint test:
--   POST /api/users/login  { "username": "Placebo", "password": "password" }
--   Expected: 200 OK with user object (role: "owner", status: "active")
--
-- The email 'placebo@local.dev' is a bootstrap placeholder.
-- It can be updated after first login via PUT /api/users/:userid.
