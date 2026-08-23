-- ============================================================
-- PLACEBO FINANCE HUB
-- COMPLETE DATABASE SCHEMA
-- PostgreSQL / Supabase
--
-- Excluded:
--   - fx_rates
--   - audit_log (already exists)
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 2. ENUMS
-- ============================================================

DO $$
BEGIN

    -- User roles
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'user_role'
    ) THEN
        CREATE TYPE user_role AS ENUM (
            'owner',
            'manager',
            'viewer'
        );
    END IF;


    -- Document status
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'document_status'
    ) THEN
        CREATE TYPE document_status AS ENUM (
            'pending_review',
            'approved',
            'rejected'
        );
    END IF;


    -- Extraction status
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'extraction_status'
    ) THEN
        CREATE TYPE extraction_status AS ENUM (
            'uploaded',
            'queued',
            'extracting',
            'ready_for_review',
            'failed'
        );
    END IF;


    -- Extraction method
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'extraction_method'
    ) THEN
        CREATE TYPE extraction_method AS ENUM (
            'pdf_text',
            'image_ocr',
            'scanned_pdf_ocr',
            'manual'
        );
    END IF;


    -- Document type
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'doc_type'
    ) THEN
        CREATE TYPE doc_type AS ENUM (
            'receipt',
            'invoice',
            'credit_note',
            'other'
        );
    END IF;


    -- FX source
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'fx_source'
    ) THEN
        CREATE TYPE fx_source AS ENUM (
            'frankfurter',
            'card_statement',
            'manual'
        );
    END IF;


    -- Payment method
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'payment_method'
    ) THEN
        CREATE TYPE payment_method AS ENUM (
            'bank_transfer',
            'credit_card',
            'cash',
            'other',
            'unknown'
        );
    END IF;


    -- Expense status
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'expense_status'
    ) THEN
        CREATE TYPE expense_status AS ENUM (
            'draft',
            'approved',
            'rejected'
        );
    END IF;


    -- Expense coverage
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'coverage_state'
    ) THEN
        CREATE TYPE coverage_state AS ENUM (
            'unmatched',
            'partially_matched',
            'fully_matched'
        );
    END IF;


    -- Statement type
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'statement_type'
    ) THEN
        CREATE TYPE statement_type AS ENUM (
            'bank_account',
            'credit_card'
        );
    END IF;


    -- Statement source
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'statement_source'
    ) THEN
        CREATE TYPE statement_source AS ENUM (
            'csv',
            'pdf',
            'manual'
        );
    END IF;


    -- Transaction status
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'txn_status'
    ) THEN
        CREATE TYPE txn_status AS ENUM (
            'unmatched',
            'matched',
            'ignored',
            'awaiting_receipt'
        );
    END IF;


    -- Match type
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'match_type'
    ) THEN
        CREATE TYPE match_type AS ENUM (
            'strong_candidate',
            'possible_candidate',
            'manual'
        );
    END IF;


    -- Match status
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'match_status'
    ) THEN
        CREATE TYPE match_status AS ENUM (
            'confirmed',
            'rejected'
        );
    END IF;


    -- Job type
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'job_type'
    ) THEN
        CREATE TYPE job_type AS ENUM (
            'extraction',
            'report'
        );
    END IF;


    -- Job status
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'job_status'
    ) THEN
        CREATE TYPE job_status AS ENUM (
            'queued',
            'running',
            'completed',
            'failed'
        );
    END IF;


    -- Report kind
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'report_kind'
    ) THEN
        CREATE TYPE report_kind AS ENUM (
            'pdf_pack',
            'excel'
        );
    END IF;

END
$$;


-- ============================================================
-- 3. USERS
-- ============================================================
--
-- ID is the Supabase Auth user ID.
-- Supabase Auth generates the UUID.
-- created_at is generated automatically by PostgreSQL.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    email TEXT NOT NULL,

    full_name TEXT NOT NULL,

    role user_role NOT NULL DEFAULT 'viewer',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    invited_by UUID
        REFERENCES users(id),

    invited_at TIMESTAMPTZ,

    accepted_at TIMESTAMPTZ,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_active
    ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_users_created_at
    ON users(created_at DESC);


-- ============================================================
-- 4. PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    code TEXT NOT NULL UNIQUE,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed')),

    start_date DATE,

    end_date DATE,

    notes TEXT
);


CREATE INDEX IF NOT EXISTS idx_projects_status
    ON projects(status);


-- ============================================================
-- 5. CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL UNIQUE,

    is_vat_deductible_default BOOLEAN NOT NULL DEFAULT TRUE,

    sort_order INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE
);


CREATE INDEX IF NOT EXISTS idx_categories_active
    ON categories(is_active);

CREATE INDEX IF NOT EXISTS idx_categories_sort_order
    ON categories(sort_order);


-- ============================================================
-- 6. VENDORS
-- ============================================================

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    normalized_name TEXT NOT NULL,

    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,

    default_category_id UUID
        REFERENCES categories(id),

    default_vat_rate NUMERIC(5,2),

    country_code CHAR(2),

    vat_number TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_vendors_normalized_name
    ON vendors(normalized_name);

CREATE INDEX IF NOT EXISTS idx_vendors_active
    ON vendors(is_active);


-- ============================================================
-- 7. COLUMN MAPPINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS column_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    statement_type statement_type NOT NULL,

    source_signature TEXT NOT NULL,

    mapping JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_column_mappings_statement_type
    ON column_mappings(statement_type);

CREATE INDEX IF NOT EXISTS idx_column_mappings_signature
    ON column_mappings(source_signature);


-- ============================================================
-- 8. APP SETTINGS
-- ============================================================
--
-- Singleton table.
-- Only one row should exist.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE
        CHECK (id = TRUE),

    company_name TEXT,

    org_number TEXT,

    vat_number TEXT,

    address TEXT,

    base_currency CHAR(3) NOT NULL DEFAULT 'SEK',

    country_code CHAR(2) NOT NULL DEFAULT 'SE',

    reconciliation_amount_tolerance NUMERIC(14,2)
        NOT NULL DEFAULT 0.01,

    reconciliation_date_window_days INTEGER
        NOT NULL DEFAULT 7,

    auto_extract_on_upload BOOLEAN
        NOT NULL DEFAULT TRUE,

    require_document_for_expense BOOLEAN
        NOT NULL DEFAULT TRUE,

    period_lock_day INTEGER
        NOT NULL DEFAULT 0
        CHECK (period_lock_day >= 0 AND period_lock_day <= 31),

    retention_years INTEGER
        NOT NULL DEFAULT 7
        CHECK (retention_years > 0)
);


-- Automatically create the singleton settings row.
INSERT INTO app_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 9. DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_no BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,

    file_name TEXT NOT NULL,

    file_type TEXT NOT NULL,

    file_size INTEGER NOT NULL
        CHECK (file_size > 0 AND file_size <= 20971520),

    storage_path TEXT NOT NULL,

    checksum_sha256 TEXT NOT NULL,

    page_count SMALLINT,

    status document_status NOT NULL
        DEFAULT 'pending_review',

    extraction_status extraction_status NOT NULL
        DEFAULT 'uploaded',

    notes TEXT,

    uploaded_by UUID NOT NULL
        REFERENCES users(id),

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    deleted_at TIMESTAMPTZ
);


CREATE INDEX IF NOT EXISTS idx_documents_status
    ON documents(status);

CREATE INDEX IF NOT EXISTS idx_documents_extraction_status
    ON documents(extraction_status);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by
    ON documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_documents_deleted_at
    ON documents(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_checksum
    ON documents(checksum_sha256)
    WHERE deleted_at IS NULL;


-- ============================================================
-- 10. DOCUMENT ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS document_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,

    file_name TEXT NOT NULL,

    file_type TEXT NOT NULL,

    file_size INTEGER NOT NULL
        CHECK (file_size > 0 AND file_size <= 20971520),

    storage_path TEXT NOT NULL,

    checksum_sha256 TEXT NOT NULL,

    uploaded_by UUID NOT NULL
        REFERENCES users(id),

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_document_attachments_document
    ON document_attachments(document_id);


-- ============================================================
-- 11. DOCUMENT EXTRACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,

    method extraction_method NOT NULL,

    fields JSONB NOT NULL,

    validation_issues JSONB NOT NULL DEFAULT '[]'::jsonb,

    full_text TEXT,

    confidence NUMERIC(4,3)
        CHECK (
            confidence IS NULL
            OR (confidence >= 0 AND confidence <= 1)
        ),

    duration_ms INTEGER,

    is_current BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_document_extractions_document
    ON document_extractions(document_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_extractions_current
    ON document_extractions(document_id)
    WHERE is_current = TRUE;


-- ============================================================
-- 12. EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    expense_no BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,

    document_id UUID UNIQUE
        REFERENCES documents(id),

    project_id UUID
        REFERENCES projects(id),

    vendor_id UUID
        REFERENCES vendors(id),

    vendor_name TEXT NOT NULL,

    document_type doc_type NOT NULL,

    document_number TEXT,

    document_date DATE NOT NULL,

    due_date DATE,

    currency CHAR(3) NOT NULL,

    country_code CHAR(2),

    net_amount NUMERIC(14,2),

    vat_amount NUMERIC(14,2),

    vat_rate NUMERIC(5,2),

    gross_amount NUMERIC(14,2) NOT NULL
        CHECK (gross_amount > 0),

    paid_amount NUMERIC(14,2) NOT NULL,

    fx_rate NUMERIC(14,6),

    fx_date DATE,

    fx_source fx_source,

    gross_amount_sek NUMERIC(14,2) NOT NULL,

    paid_amount_sek NUMERIC(14,2) NOT NULL,

    vat_amount_sek NUMERIC(14,2),

    is_reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,

    is_vat_deductible BOOLEAN NOT NULL DEFAULT TRUE,

    category_id UUID NOT NULL
        REFERENCES categories(id),

    payment_method payment_method NOT NULL,

    coverage_state coverage_state NOT NULL
        DEFAULT 'unmatched',

    notes TEXT,

    status expense_status NOT NULL
        DEFAULT 'draft',

    created_by UUID
        REFERENCES users(id),

    approved_by UUID
        REFERENCES users(id),

    approved_at TIMESTAMPTZ,

    deleted_at TIMESTAMPTZ
);


CREATE INDEX IF NOT EXISTS idx_expenses_document
    ON expenses(document_id);

CREATE INDEX IF NOT EXISTS idx_expenses_project
    ON expenses(project_id);

CREATE INDEX IF NOT EXISTS idx_expenses_vendor
    ON expenses(vendor_id);

CREATE INDEX IF NOT EXISTS idx_expenses_category
    ON expenses(category_id);

CREATE INDEX IF NOT EXISTS idx_expenses_document_date
    ON expenses(document_date);

CREATE INDEX IF NOT EXISTS idx_expenses_status
    ON expenses(status);

CREATE INDEX IF NOT EXISTS idx_expenses_coverage
    ON expenses(coverage_state);

CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at
    ON expenses(deleted_at);


-- ============================================================
-- 13. STATEMENTS
-- ============================================================
--
-- statement_id in transactions depends on this table.
-- settled_by_transaction_id cannot reference transactions yet,
-- so that FK is added later.
-- ============================================================

CREATE TABLE IF NOT EXISTS statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    statement_type statement_type NOT NULL,

    period CHAR(7) NOT NULL
        CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),

    account_label TEXT,

    account_ref TEXT,

    period_from DATE,

    period_to DATE,

    opening_balance NUMERIC(14,2),

    closing_balance NUMERIC(14,2),

    total_amount NUMERIC(14,2),

    settled_by_transaction_id UUID,

    source statement_source NOT NULL,

    column_mapping_id UUID
        REFERENCES column_mappings(id),

    file_name TEXT,

    storage_path TEXT,

    transaction_count INTEGER NOT NULL DEFAULT 0,

    is_locked BOOLEAN NOT NULL DEFAULT FALSE,

    uploaded_by UUID
        REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_statements_period
    ON statements(period);

CREATE INDEX IF NOT EXISTS idx_statements_type
    ON statements(statement_type);

CREATE INDEX IF NOT EXISTS idx_statements_mapping
    ON statements(column_mapping_id);

CREATE INDEX IF NOT EXISTS idx_statements_settled_transaction
    ON statements(settled_by_transaction_id);


-- ============================================================
-- 14. TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    statement_id UUID NOT NULL
        REFERENCES statements(id)
        ON DELETE CASCADE,

    statement_period CHAR(7) NOT NULL,

    line_no INTEGER,

    transaction_date DATE NOT NULL,

    posting_date DATE,

    description TEXT NOT NULL,

    normalized_description TEXT NOT NULL,

    counterparty_ref TEXT,

    original_amount NUMERIC(14,2),

    original_currency CHAR(3),

    statement_fx_rate NUMERIC(14,6),

    billed_amount NUMERIC(14,2) NOT NULL,

    billed_currency CHAR(3) NOT NULL DEFAULT 'SEK',

    status txn_status NOT NULL DEFAULT 'unmatched',

    coverage_state coverage_state NOT NULL
        DEFAULT 'unmatched',

    ignore_reason TEXT,

    row_hash TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT transactions_ignored_reason_check
        CHECK (
            status <> 'ignored'
            OR ignore_reason IS NOT NULL
        )
);


CREATE INDEX IF NOT EXISTS idx_transactions_statement
    ON transactions(statement_id);

CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions(status);

CREATE INDEX IF NOT EXISTS idx_transactions_coverage
    ON transactions(coverage_state);

CREATE INDEX IF NOT EXISTS idx_transactions_normalized_description
    ON transactions(normalized_description);


-- ============================================================
-- 15. NOW ADD THE STATEMENT -> TRANSACTION FK
-- ============================================================

ALTER TABLE statements
    ADD CONSTRAINT fk_statements_settled_transaction
    FOREIGN KEY (settled_by_transaction_id)
    REFERENCES transactions(id);


-- ============================================================
-- 16. MATCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    expense_id UUID NOT NULL
        REFERENCES expenses(id)
        ON DELETE CASCADE,

    transaction_id UUID NOT NULL
        REFERENCES transactions(id)
        ON DELETE CASCADE,

    allocated_amount NUMERIC(14,2) NOT NULL
        CHECK (allocated_amount > 0),

    score SMALLINT
        CHECK (
            score IS NULL
            OR (score >= 0 AND score <= 100)
        ),

    match_type match_type NOT NULL,

    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,

    status match_status NOT NULL,

    confirmed_by UUID
        REFERENCES users(id),

    confirmed_at TIMESTAMPTZ,

    revalidated_at TIMESTAMPTZ,

    UNIQUE (
        expense_id,
        transaction_id
    )
);


CREATE INDEX IF NOT EXISTS idx_matches_expense
    ON matches(expense_id);

CREATE INDEX IF NOT EXISTS idx_matches_transaction
    ON matches(transaction_id);

CREATE INDEX IF NOT EXISTS idx_matches_status
    ON matches(status);


-- ============================================================
-- 17. JOBS
-- ============================================================

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_type job_type NOT NULL,

    document_id UUID
        REFERENCES documents(id),

    statement_id UUID
        REFERENCES statements(id),

    period CHAR(7),

    status job_status NOT NULL DEFAULT 'queued',

    stage TEXT,

    progress INTEGER NOT NULL DEFAULT 0
        CHECK (progress >= 0 AND progress <= 100),

    attempts INTEGER NOT NULL DEFAULT 0,

    error_code TEXT,

    error_message TEXT,

    result_path TEXT,

    started_at TIMESTAMPTZ,

    finished_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_jobs_status
    ON jobs(status);

CREATE INDEX IF NOT EXISTS idx_jobs_type
    ON jobs(job_type);

CREATE INDEX IF NOT EXISTS idx_jobs_document
    ON jobs(document_id);

CREATE INDEX IF NOT EXISTS idx_jobs_statement
    ON jobs(statement_id);


-- ============================================================
-- 18. REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    period CHAR(7) NOT NULL
        CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),

    project_id UUID
        REFERENCES projects(id),

    kind report_kind NOT NULL,

    storage_path TEXT NOT NULL,

    generated_by UUID
        REFERENCES users(id),

    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    is_current BOOLEAN NOT NULL DEFAULT TRUE
);


CREATE INDEX IF NOT EXISTS idx_reports_period
    ON reports(period);

CREATE INDEX IF NOT EXISTS idx_reports_project
    ON reports(project_id);

CREATE INDEX IF NOT EXISTS idx_reports_current
    ON reports(is_current);


-- ============================================================
-- 19. UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- ============================================================
-- 20. DOCUMENT UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trg_documents_updated_at
ON documents;

CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 21. STATEMENT TRANSACTION COUNT
-- ============================================================
--
-- Maintains:
-- statements.transaction_count
-- ============================================================

CREATE OR REPLACE FUNCTION update_statement_transaction_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF TG_OP = 'INSERT' THEN

        UPDATE statements
        SET transaction_count = transaction_count + 1
        WHERE id = NEW.statement_id;

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN

        UPDATE statements
        SET transaction_count = GREATEST(transaction_count - 1, 0)
        WHERE id = OLD.statement_id;

        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN

        IF OLD.statement_id <> NEW.statement_id THEN

            UPDATE statements
            SET transaction_count =
                GREATEST(transaction_count - 1, 0)
            WHERE id = OLD.statement_id;

            UPDATE statements
            SET transaction_count =
                transaction_count + 1
            WHERE id = NEW.statement_id;

        END IF;

        RETURN NEW;

    END IF;

    RETURN NULL;

END;
$$;


DROP TRIGGER IF EXISTS trg_transactions_statement_count
ON transactions;

CREATE TRIGGER trg_transactions_statement_count
AFTER INSERT OR UPDATE OR DELETE
ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_statement_transaction_count();


-- ============================================================
-- 22. MATCH ALLOCATION VALIDATION
-- ============================================================
--
-- SUM(allocated_amount) per expense
-- <= expenses.paid_amount_sek
--
-- SUM(allocated_amount) per transaction
-- <= transactions.billed_amount
--
-- Rejected matches do not count toward allocation.
-- ============================================================

CREATE OR REPLACE FUNCTION validate_match_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    expense_total NUMERIC(14,2);
    expense_limit NUMERIC(14,2);

    transaction_total NUMERIC(14,2);
    transaction_limit NUMERIC(14,2);
BEGIN

    -- --------------------------------------------
    -- EXPENSE
    -- --------------------------------------------

    SELECT paid_amount_sek
    INTO expense_limit
    FROM expenses
    WHERE id = NEW.expense_id;

    IF expense_limit IS NULL THEN
        RAISE EXCEPTION
            'Expense % does not exist',
            NEW.expense_id;
    END IF;


    SELECT COALESCE(SUM(allocated_amount), 0)
    INTO expense_total
    FROM matches
    WHERE expense_id = NEW.expense_id
      AND status = 'confirmed'
      AND id <> COALESCE(NEW.id, gen_random_uuid());


    IF NEW.status = 'confirmed' THEN
        expense_total :=
            expense_total + NEW.allocated_amount;
    END IF;


    IF expense_total > expense_limit + 0.01 THEN

        RAISE EXCEPTION
            'Expense allocation exceeds paid_amount_sek. Expense %, allocated %, limit %',
            NEW.expense_id,
            expense_total,
            expense_limit;

    END IF;


    -- --------------------------------------------
    -- TRANSACTION
    -- --------------------------------------------

    SELECT billed_amount
    INTO transaction_limit
    FROM transactions
    WHERE id = NEW.transaction_id;

    IF transaction_limit IS NULL THEN
        RAISE EXCEPTION
            'Transaction % does not exist',
            NEW.transaction_id;
    END IF;


    SELECT COALESCE(SUM(allocated_amount), 0)
    INTO transaction_total
    FROM matches
    WHERE transaction_id = NEW.transaction_id
      AND status = 'confirmed'
      AND id <> COALESCE(NEW.id, gen_random_uuid());


    IF NEW.status = 'confirmed' THEN
        transaction_total :=
            transaction_total + NEW.allocated_amount;
    END IF;


    IF transaction_total > transaction_limit + 0.01 THEN

        RAISE EXCEPTION
            'Transaction allocation exceeds billed_amount. Transaction %, allocated %, limit %',
            NEW.transaction_id,
            transaction_total,
            transaction_limit;

    END IF;


    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trg_validate_match_allocation
ON matches;

CREATE TRIGGER trg_validate_match_allocation
BEFORE INSERT OR UPDATE
ON matches
FOR EACH ROW
EXECUTE FUNCTION validate_match_allocation();


-- ============================================================
-- 23. COVERAGE STATE CALCULATION
-- ============================================================
--
-- Expense:
--   0                         -> unmatched
--   >0 and < paid_amount_sek -> partially_matched
--   >= paid_amount_sek       -> fully_matched
--
-- Transaction:
--   0                         -> unmatched
--   >0 and < billed_amount   -> partially_matched
--   >= billed_amount         -> fully_matched
--
-- Tolerance = 0.01
-- Only confirmed matches count.
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_match_coverage(
    p_expense_id UUID,
    p_transaction_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE

    expense_allocated NUMERIC(14,2);
    expense_limit NUMERIC(14,2);

    transaction_allocated NUMERIC(14,2);
    transaction_limit NUMERIC(14,2);

BEGIN

    -- ============================================
    -- EXPENSE
    -- ============================================

    IF p_expense_id IS NOT NULL THEN

        SELECT paid_amount_sek
        INTO expense_limit
        FROM expenses
        WHERE id = p_expense_id;

        SELECT COALESCE(SUM(allocated_amount), 0)
        INTO expense_allocated
        FROM matches
        WHERE expense_id = p_expense_id
          AND status = 'confirmed';

        UPDATE expenses
        SET coverage_state =
            CASE

                WHEN expense_allocated <= 0
                    THEN 'unmatched'::coverage_state

                WHEN expense_allocated >=
                     expense_limit - 0.01
                    THEN 'fully_matched'::coverage_state

                ELSE
                    'partially_matched'::coverage_state

            END

        WHERE id = p_expense_id;

    END IF;


    -- ============================================
    -- TRANSACTION
    -- ============================================

    IF p_transaction_id IS NOT NULL THEN

        SELECT billed_amount
        INTO transaction_limit
        FROM transactions
        WHERE id = p_transaction_id;

        SELECT COALESCE(SUM(allocated_amount), 0)
        INTO transaction_allocated
        FROM matches
        WHERE transaction_id = p_transaction_id
          AND status = 'confirmed';

        UPDATE transactions
        SET coverage_state =
            CASE

                WHEN transaction_allocated <= 0
                    THEN 'unmatched'::coverage_state

                WHEN transaction_allocated >=
                     transaction_limit - 0.01
                    THEN 'fully_matched'::coverage_state

                ELSE
                    'partially_matched'::coverage_state

            END

        WHERE id = p_transaction_id;

    END IF;

END;
$$;


-- ============================================================
-- 24. MATCH COVERAGE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_match_coverage_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF TG_OP = 'DELETE' THEN

        PERFORM refresh_match_coverage(
            OLD.expense_id,
            OLD.transaction_id
        );

        RETURN OLD;

    END IF;


    PERFORM refresh_match_coverage(
        NEW.expense_id,
        NEW.transaction_id
    );


    IF TG_OP = 'UPDATE'
       AND (
            OLD.expense_id <> NEW.expense_id
            OR OLD.transaction_id <> NEW.transaction_id
       )
    THEN

        PERFORM refresh_match_coverage(
            OLD.expense_id,
            OLD.transaction_id
        );

    END IF;


    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trg_refresh_match_coverage
ON matches;

CREATE TRIGGER trg_refresh_match_coverage
AFTER INSERT OR UPDATE OR DELETE
ON matches
FOR EACH ROW
EXECUTE FUNCTION refresh_match_coverage_trigger();


-- ============================================================
-- 25. DOCUMENT EXTRACTION CURRENT-ROW VALIDATION
-- ============================================================
--
-- Ensures that only one extraction can be current.
-- The unique partial index above is the actual enforcement.
-- This trigger automatically turns previous current extraction
-- off when a new extraction becomes current.
-- ============================================================

CREATE OR REPLACE FUNCTION set_current_document_extraction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.is_current = TRUE THEN

        UPDATE document_extractions
        SET is_current = FALSE
        WHERE document_id = NEW.document_id
          AND id <> NEW.id
          AND is_current = TRUE;

    END IF;

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trg_document_extraction_current
ON document_extractions;

CREATE TRIGGER trg_document_extraction_current
BEFORE INSERT OR UPDATE
ON document_extractions
FOR EACH ROW
WHEN (NEW.is_current = TRUE)
EXECUTE FUNCTION set_current_document_extraction();


-- ============================================================
-- 26. KEEP DOCUMENT EXTRACTION STATUS IN SYNC
-- ============================================================

CREATE OR REPLACE FUNCTION update_document_extraction_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    UPDATE documents
    SET extraction_status =
        CASE

            WHEN NEW.method IS NOT NULL
                 AND NEW.is_current = TRUE
                 AND NEW.validation_issues = '[]'::jsonb
                THEN 'ready_for_review'::extraction_status

            ELSE extraction_status

        END

    WHERE id = NEW.document_id;

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trg_document_extraction_status
ON document_extractions;

CREATE TRIGGER trg_document_extraction_status
AFTER INSERT OR UPDATE
ON document_extractions
FOR EACH ROW
EXECUTE FUNCTION update_document_extraction_status();


-- ============================================================
-- 27. DOCUMENT ATTACHMENT CHECKSUM INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_document_attachments_checksum
    ON document_attachments(checksum_sha256);


-- ============================================================
-- 28. MATCH REVALIDATION TIMESTAMP
-- ============================================================

CREATE OR REPLACE FUNCTION set_match_revalidated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF TG_OP = 'UPDATE' THEN
        NEW.revalidated_at = now();
    END IF;

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trg_match_revalidated_at
ON matches;

CREATE TRIGGER trg_match_revalidated_at
BEFORE UPDATE
ON matches
FOR EACH ROW
EXECUTE FUNCTION set_match_revalidated_at();


-- ============================================================
-- 29. BASIC DATA INTEGRITY CHECKS
-- ============================================================

ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS expenses_paid_amount_check;

ALTER TABLE expenses
    ADD CONSTRAINT expenses_paid_amount_check
    CHECK (paid_amount >= 0);


ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS expenses_vat_rate_check;

ALTER TABLE expenses
    ADD CONSTRAINT expenses_vat_rate_check
    CHECK (
        vat_rate IS NULL
        OR (vat_rate >= 0 AND vat_rate <= 100)
    );


ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS transactions_billed_amount_check;

ALTER TABLE transactions
    ADD CONSTRAINT transactions_billed_amount_check
    CHECK (billed_amount >= 0);


ALTER TABLE matches
    DROP CONSTRAINT IF EXISTS matches_allocated_amount_check;

ALTER TABLE matches
    ADD CONSTRAINT matches_allocated_amount_check
    CHECK (allocated_amount > 0);


-- ============================================================
-- 30. EXPENSE APPROVAL VALIDATION
-- ============================================================
--
-- When an expense is approved:
--   - approved_by must exist
--   - approved_at is populated
--
-- When it is not approved:
--   - approval fields are not automatically removed
--     so the approval history remains available.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_expense_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.status = 'approved'
       AND OLD.status IS DISTINCT FROM 'approved'
    THEN

        IF NEW.approved_by IS NULL THEN

            RAISE EXCEPTION
                'approved_by is required when approving an expense';

        END IF;

        NEW.approved_at = COALESCE(
            NEW.approved_at,
            now()
        );

    END IF;

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trg_expense_approval
ON expenses;

CREATE TRIGGER trg_expense_approval
BEFORE UPDATE
ON expenses
FOR EACH ROW
EXECUTE FUNCTION handle_expense_approval();


-- ============================================================
-- 31. DOCUMENT SOFT DELETE INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_active
    ON documents(id)
    WHERE deleted_at IS NULL;


CREATE INDEX IF NOT EXISTS idx_expenses_active
    ON expenses(id)
    WHERE deleted_at IS NULL;


-- ============================================================
-- 32. STATEMENT PERIOD INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_statements_period_type
    ON statements(period, statement_type);


-- ============================================================
-- 33. TRANSACTION ROW ORDER
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transactions_statement_line
    ON transactions(statement_id, line_no);


-- ============================================================
-- 34. REPORT CURRENT VERSION
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_reports_current_period
    ON reports(period, is_current);


-- ============================================================
-- 35. JOB QUEUE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_jobs_queue
    ON jobs(status, created_at);


-- ============================================================
-- END
-- ============================================================