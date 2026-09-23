-- ===============================================================
-- SAN BENITO MIX 2026 — PostgreSQL / Supabase Schema
-- Includes tables, types, indexes, RLS policies, and Realtime publication
-- ===============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('master', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE product_category AS ENUM ('frutos_secos', 'platanitos', 'turrones', 'varios');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'payroll', 'adjustment', 'client_payment');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE client_status AS ENUM ('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE rate_source AS ENUM ('bcv_usd', 'bcv_eur', 'binance_usdt');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE platanitos_flavor AS ENUM ('Maduro', 'Salado', 'Ajo', 'Picante', 'Ondulado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '👤',
    pin_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. User Settings (RBAC Permissions)
CREATE TABLE IF NOT EXISTS settings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    view_costs BOOLEAN DEFAULT false,
    view_margins BOOLEAN DEFAULT false,
    view_wallet BOOLEAN DEFAULT false,
    edit_ledger BOOLEAN DEFAULT false,
    register_payroll BOOLEAN DEFAULT false,
    modify_rates BOOLEAN DEFAULT false,
    apply_surcharges BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Exchange Rates
CREATE TABLE IF NOT EXISTS exchange_rates (
    id BIGSERIAL PRIMARY KEY,
    source rate_source NOT NULL,
    rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT false,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rates_source ON exchange_rates(source);
CREATE INDEX IF NOT EXISTS idx_rates_active ON exchange_rates(is_active);

-- 4. Products
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    category product_category NOT NULL,
    name TEXT NOT NULL,
    photo TEXT DEFAULT '📦',
    flavor platanitos_flavor,
    cost_total_usd NUMERIC(12, 2) DEFAULT 0,
    cost_total_ves NUMERIC(18, 2) DEFAULT 0,
    total_weight_grams NUMERIC(10, 2),
    pack_weight_grams NUMERIC(10, 2),
    pack_count INTEGER,
    bulk_quantity INTEGER,
    margin_percent NUMERIC(6, 2) DEFAULT 30,
    cost_unit_usd NUMERIC(12, 4) DEFAULT 0,
    cost_unit_ves NUMERIC(18, 4) DEFAULT 0,
    price_usd NUMERIC(12, 4) DEFAULT 0,
    price_ves NUMERIC(18, 4) DEFAULT 0,
    stock INTEGER DEFAULT 0,
    combo_units INTEGER,
    combo_price NUMERIC(12, 4),
    unit_type TEXT DEFAULT 'Unidad',
    item_category TEXT DEFAULT 'Mercancía Comercial',
    min_stock INTEGER DEFAULT 5,
    sku TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- 5. Losses (Mermas)
CREATE TABLE IF NOT EXISTS losses (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    monetary_loss_usd NUMERIC(12, 2) DEFAULT 0,
    monetary_loss_ves NUMERIC(18, 2) DEFAULT 0,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    user_id BIGINT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_losses_product ON losses(product_id);
CREATE INDEX IF NOT EXISTS idx_losses_date ON losses(registered_at);

-- 6. Bank Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id BIGSERIAL PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'VES',
    balance NUMERIC(18, 2) DEFAULT 0,
    card_last4 TEXT DEFAULT '0000',
    color TEXT DEFAULT '#333333',
    icon TEXT DEFAULT '🏦',
    sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency);

-- 7. Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    type transaction_type NOT NULL,
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'VES',
    amount_usd NUMERIC(12, 2) DEFAULT 0,
    amount_ves NUMERIC(18, 2) DEFAULT 0,
    account_id BIGINT REFERENCES accounts(id),
    account_name TEXT,
    description TEXT,
    client_id BIGINT,
    rate_used NUMERIC(18, 4) DEFAULT 0,
    rate_source rate_source,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    user_id BIGINT REFERENCES users(id),
    user_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(registered_at);
CREATE INDEX IF NOT EXISTS idx_tx_client ON transactions(client_id);

-- 8. Audit Log (Immutable)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT REFERENCES transactions(id),
    field TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    user_id BIGINT REFERENCES users(id),
    user_name TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tx ON audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(logged_at);

-- 9. Clients
CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    debt_usd NUMERIC(12, 2) DEFAULT 0,
    debt_ves NUMERIC(18, 2) DEFAULT 0,
    rate_at_creation NUMERIC(18, 4) DEFAULT 0,
    due_date TIMESTAMPTZ,
    status client_status DEFAULT 'pending',
    surcharge_percent NUMERIC(6, 2) DEFAULT 0,
    surcharge_active BOOLEAN DEFAULT false,
    paid_date TIMESTAMPTZ,
    paid_account_id BIGINT REFERENCES accounts(id),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- 10. Dispatches (Despachos)
CREATE TABLE IF NOT EXISTS dispatches (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_photo TEXT,
    category product_category NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    previous_stock INTEGER NOT NULL DEFAULT 0,
    new_stock INTEGER NOT NULL DEFAULT 0,
    unit_price_usd NUMERIC(12, 4) DEFAULT 0,
    total_usd NUMERIC(12, 2) DEFAULT 0,
    receiver_name TEXT NOT NULL,
    delivered_by TEXT NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    user_id BIGINT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_dispatches_date ON dispatches(registered_at);

-- 11. Production Batches (Lotes)
CREATE TABLE IF NOT EXISTS production_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_code TEXT NOT NULL UNIQUE,
    process_type TEXT NOT NULL,
    raw_ingredient_name TEXT NOT NULL,
    raw_weight_kg NUMERIC(10, 3) NOT NULL DEFAULT 0,
    raw_cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
    output_weight_kg NUMERIC(10, 3) NOT NULL DEFAULT 0,
    loss_kg NUMERIC(10, 3) NOT NULL DEFAULT 0,
    loss_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
    net_cost_per_kg_usd NUMERIC(12, 4) NOT NULL DEFAULT 0,
    target_product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    target_product_name TEXT,
    units_produced INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    user_id BIGINT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_batches_date ON production_batches(registered_at);

-- 12. Cash Closures (Cierres de Caja)
CREATE TABLE IF NOT EXISTS cash_closures (
    id BIGSERIAL PRIMARY KEY,
    closure_code TEXT NOT NULL UNIQUE,
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    closed_by_user_id BIGINT REFERENCES users(id),
    closed_by_user_name TEXT NOT NULL,
    total_system_usd NUMERIC(12, 2) DEFAULT 0,
    total_physical_usd NUMERIC(12, 2) DEFAULT 0,
    total_diff_usd NUMERIC(12, 2) DEFAULT 0,
    total_system_ves NUMERIC(18, 2) DEFAULT 0,
    total_physical_ves NUMERIC(18, 2) DEFAULT 0,
    total_diff_ves NUMERIC(18, 2) DEFAULT 0,
    rate_used NUMERIC(18, 4) DEFAULT 0,
    accounts_detail JSONB DEFAULT '[]'::jsonb,
    observations TEXT,
    status TEXT DEFAULT 'locked'
);
CREATE INDEX IF NOT EXISTS idx_closures_date ON cash_closures(closed_at);

-- 13. Sync Queue
CREATE TABLE IF NOT EXISTS sync_queue (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id BIGINT NOT NULL,
    data JSONB,
    synced BOOLEAN DEFAULT false,
    retries INTEGER DEFAULT 0,
    queued_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_pending ON sync_queue(synced, queued_at);

-- ===============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — Permissive for App Sync
-- ===============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS users_all ON users;
    CREATE POLICY users_all ON users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS settings_all ON settings;
    CREATE POLICY settings_all ON settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS rates_all ON exchange_rates;
    CREATE POLICY rates_all ON exchange_rates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS products_all ON products;
    CREATE POLICY products_all ON products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS accounts_all ON accounts;
    CREATE POLICY accounts_all ON accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS clients_all ON clients;
    CREATE POLICY clients_all ON clients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS tx_all ON transactions;
    CREATE POLICY tx_all ON transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS losses_all ON losses;
    CREATE POLICY losses_all ON losses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS dispatches_all ON dispatches;
    CREATE POLICY dispatches_all ON dispatches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS batches_all ON production_batches;
    CREATE POLICY batches_all ON production_batches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS closures_all ON cash_closures;
    CREATE POLICY closures_all ON cash_closures FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS audit_all ON audit_log;
    CREATE POLICY audit_all ON audit_log FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN null;
END $$;

-- Enable Realtime Publication
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE products, accounts, transactions, clients, losses, dispatches, production_batches, cash_closures, exchange_rates;
EXCEPTION WHEN OTHERS THEN null;
END $$;
