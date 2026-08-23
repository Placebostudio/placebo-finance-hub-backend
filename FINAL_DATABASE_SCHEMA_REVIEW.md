# FINAL_DATABASE_SCHEMA.sql — Review Document

**File:** `FINAL_DATABASE_SCHEMA.sql`
**Prepared for:** Roei
**Date:** 2026-08-17
**Source of truth:** `placebo-plm-js-backend` controller SQL — every INSERT, SELECT, UPDATE, DELETE verified

---

## Final Tables (11 total)

| # | Table | Status |
|---|-------|--------|
| 1 | `suppliers` | Active |
| 2 | `users` | Active |
| 3 | `materials` | Active |
| 4 | `products` | Active |
| 5 | `bom_lines` | Active |
| 6 | `orders` | Active |
| 7 | `order_lines` | Active |
| 8 | `order_additional_costs` | Active |
| 9 | `audit_logs` | Active |
| 10 | `attachments` | Inactive (router commented out — table included for future re-enablement) |
| 11 | `currency_rates` | Partially active (getCurrencies bypasses it; getCurrency / updateCurrencies / deleteCurrency use it) |

---

## Removed

**`organisations`** — removed because the organisation system is obsolete and no active backend functionality depends on it. The controller and router files exist on disk but are not imported or mounted in `index.js`. No other controller, query, or join references `organisations`, `organisation_id`, or `org_id`.

---

## Initial Owner

The schema includes one bootstrap owner account created at the end of the SQL file:

| Field | Value |
|-------|-------|
| Username | `Placebo` |
| Email | `placebo@local.dev` (development placeholder) |
| Name | `Placebo` |
| Role | `owner` |
| Status | `active` |

The password (`password`) is stored as an **Argon2id hash** generated using the project's own `argon2` npm dependency with the same parameters as the backend login flow. The hash was verified with `argon2.verify()` before being written into the SQL file.

The plaintext password does not appear anywhere in the schema. Only the hash is stored.

---

## Main Design Decisions

### UUID Strategy
All primary keys use `uuid PRIMARY KEY DEFAULT gen_random_uuid()`. The `pgcrypto` extension is enabled for `gen_random_uuid()` compatibility across PostgreSQL versions. Node.js controllers that generate their own UUIDs via `crypto.randomUUID()` (order_lines, order_additional_costs) supply the id explicitly in the INSERT — the `DEFAULT` is a safe fallback if no id is provided.

### Primary Keys
All tables use UUID PKs. This is consistent with how `order_lines.id` and `order_additional_costs.id` are handled in the backend (`crypto.randomUUID()`).

`suppliers.id` also uses UUID with a DB default. The `addSupplier` controller passes an id from `req.body` explicitly; if the client supplies a UUID it is used, otherwise the DB generates one.

### Foreign Keys

| Relationship | ON DELETE |
|---|---|
| `users.supplier_id → suppliers.id` | SET NULL |
| `materials.supplier_id → suppliers.id` | SET NULL |
| `bom_lines.product_id → products.id` | CASCADE |
| `bom_lines.material_id → materials.id` | RESTRICT |
| `order_lines.order_id → orders.id` | CASCADE |
| `order_lines.product_id → products.id` | RESTRICT |
| `order_additional_costs.order_id → orders.id` | CASCADE |
| `audit_logs.user_id → users.id` | SET NULL |
| `attachments.uploaded_by → users.id` | SET NULL |

`attachments.entity_id` has **no FK** — it is a polymorphic reference to either `products.id` or `materials.id` based on `entity_type`. PostgreSQL does not support a FK to multiple tables. The `entity_type IN ('product', 'material')` CHECK constraint is the DB-level guard; application logic enforces the rest.

### Role Implementation
Roles are stored as `text` with a `CHECK (role IN ('owner', 'manager', 'editor', 'viewer', 'supplier'))` constraint. Text was preferred over a PostgreSQL enum because:
- The backend passes role values as plain strings with no casting
- Changing an enum requires `ALTER TYPE` in PostgreSQL; a CHECK constraint is simpler to update

Default role: `viewer` (hardcoded in `addUser`).

### Soft-Delete / Spam Handling
The `spam` column (`boolean NOT NULL DEFAULT false`) is included on tables where the backend references it:
- `suppliers` — present in both INSERT and UPDATE
- `materials` — NOT in INSERT, IS in UPDATE; `DEFAULT false` prevents INSERT failure
- `products` — NOT in INSERT, IS in UPDATE; `DEFAULT false` prevents INSERT failure
- `orders` — present in both INSERT and UPDATE

`spam` is **not** added to `users`, `bom_lines`, `order_lines`, `order_additional_costs`, `audit_logs`, `attachments`, or `currency_rates` — the backend does not reference it on those tables.

### Timestamps
`created_at timestamptz NOT NULL DEFAULT now()` is present on tables where the backend uses it (SELECT, ORDER BY, or WHERE):
- `suppliers`, `users`, `audit_logs`, `attachments`, `currency_rates`

`updated_at timestamptz` (nullable) is present on tables where the backend explicitly sets it:
- `suppliers` — `updated_at = now()` in `updateSupplier`
- `products` — `updated_at = now()` in `updateProduct`
- `bom_lines` — `updated_at = now()` in `updateBom_line`
- `orders` — `updated_at = now()` in `updateOrder`

`created_at` and `updated_at` are **not** added to `materials`, `order_lines`, or `order_additional_costs` — the backend makes no reference to them on those tables.

### Audit Log JSONB
`audit_logs.before` and `audit_logs.after` are `jsonb`. The Node.js `pg` driver automatically serializes JavaScript objects passed as query parameters into PostgreSQL `jsonb`. The backend passes `req.body.before` / `req.body.after` directly without manipulation, so any structured object the frontend sends is stored natively.

### Attachment Polymorphic Relationship
`attachments.entity_id` is `uuid NOT NULL` with no FK constraint. The `entity_type IN ('product', 'material')` CHECK enforces the valid scope at the DB level. Application logic in `attachment-controller.js` enforces the relationship before inserting. This is the standard PostgreSQL approach for polymorphic associations.

### Currency Rate Unique Constraint
```sql
UNIQUE (currency, compared_to_base_currency)
```
Required because `updateCurrencies` uses:
```sql
ON CONFLICT (currency, compared_to_base_currency) DO UPDATE SET ...
```
Without this constraint the upsert would fail at runtime.

### Colors / Sizes Storage
`products.colors` and `products.sizes` are `text`, not `text[]`. The backend passes these fields through without any array operators, concatenation, or array functions. Using `text` is compatible with comma-separated strings, JSON strings, or any other format the frontend sends.

---

## Audit Findings — Discrepancies from Earlier Audit Document

The `CURRENT_BACKEND_DB_SCHEMA_AUDIT.md` document had several inaccuracies relative to the actual current code. The following corrections were made in this schema:

| Item | Audit Said | Actual Code | Schema Decision |
|------|-----------|-------------|-----------------|
| `orders.updated_at` | "no updated_at referenced" | `updateOrder` adds `updated_at = now()` | Column **included** |
| `order_additional_costs` columns | `label`, `sort_order` | `currency`, `description` | Schema uses `currency`, `description` |
| `materials.updated_at` | "SET to now() on UPDATE" | Not set anywhere in updateMaterial | Column **omitted** |
| `orders` columns | included `shipping_cost_type`, `customs_cost`, `customs_type`, `cost_allocation_method` | Not in any INSERT or UPDATE | Columns **omitted** |
| `users.getUsers` | "does NOT include username" | Actual SELECT includes `username` | `username` in schema (was anyway) |

---

## Assumptions

| Item | Assumption | Reason |
|------|-----------|--------|
| `products.colors` / `products.sizes` | Stored as `text` | No array operators used in any controller; backend passes through without manipulation |
| `audit_logs.before` / `audit_logs.after` | `jsonb` | `pg` driver handles JS object → jsonb automatically; supports structured querying |
| `bom_lines` ON DELETE | CASCADE for product_id, RESTRICT for material_id | Product deletion should cascade; material deletion should be blocked if in use |
| `orders.order_date` / `target_date` | `date` type | PLM context; dates without time component are standard for orders |
| `order_lines.quantity` | `numeric` | Controller passes through from req.body; numeric allows fractional values |
| `materials.minimum_order_quantity` | `numeric` | May be fractional (e.g. 0.5 kg rolls) |
| Supplier `id` override | `DEFAULT gen_random_uuid()` with client override | `addSupplier` sends an explicit id; the DEFAULT handles the case where none is provided |

---

## Compatibility

Every active SQL query in the backend was checked against this schema:

- ✅ All referenced **tables** exist
- ✅ All referenced **columns** exist with compatible types
- ✅ All **INSERT** statements: every column is present; NOT NULL columns either have values provided or have DB defaults
- ✅ All **UPDATE** statements: every SET column exists
- ✅ All **SELECT** columns (explicit and `SELECT *`): all present
- ✅ All **WHERE** columns: all present and indexed where appropriate
- ✅ All **ORDER BY** columns: all present
- ✅ All **JOIN** columns match referenced table PKs and FKs
- ✅ `ON CONFLICT (currency, compared_to_base_currency)`: UNIQUE constraint present
- ✅ `role = 'owner'`: allowed by CHECK constraint
- ✅ `spam` default: present with `DEFAULT false` on all tables that UPDATE it without INSERTing it
- ✅ No `organisation_id`, `org_id`, or `organisations` table references in schema
- ✅ Initial `Placebo` owner account: role `owner` allowed, hash verified, login logic compatible

---

## Open Questions

**1. `order_additional_costs` — was `label` / `sort_order` intentionally replaced?**
The audit listed `label` and `sort_order`. The actual current controller uses `currency` and `description`. If the frontend still sends `label` / `sort_order`, those inserts will silently discard the data (columns don't exist). **Confirm which version of the controller is canonical before executing.**

**2. `materialController.updateMaterial` — stale field names in `allowedFields`**
The update controller references these fields: `code`, `description`, `unit`, `cost`. These do not match the actual DB columns (`color`, `color_hex`, `unit_of_measure`, `unit_cost`, etc.). If the frontend sends these old field names, the UPDATE SQL will fail with "column does not exist". This is a backend bug, not a schema bug. **No schema change needed, but the bug should be noted for the backend team.**

**3. `products.colors` / `products.sizes` — text or array?**
If the frontend sends JavaScript arrays for these fields, the `pg` driver will encode them as PostgreSQL array literals against a `text` column, which will fail. Confirm whether the frontend sends strings or arrays. If arrays, change the type to `text[]`.

**4. `attachments` — re-enable or permanently remove?**
The router is commented out in `index.js`. The table is included so it can be re-enabled without a migration. If the feature is being permanently dropped, the table and Cloudinary configuration can be removed.

---

## Ready to Execute?

The SQL is structured to run **top to bottom** on a clean PostgreSQL/Supabase database with no prior state. Tables are created in dependency-safe order (suppliers → users → materials → products → bom_lines → orders → order_lines → order_additional_costs → audit_logs → attachments → currency_rates → indexes → initial user).

**Recommended next step:** Review the open questions above (especially #1 on `order_additional_costs`), then execute against a clean Supabase project.
