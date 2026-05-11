-- ============================================================
-- Migration 001 — Pawoon Sync Layer
-- Tables auto-populated by n8n. Treated as read-only by app.
-- Reverse: DROP TABLE pawoon_sync_log, pawoon_stock_cards, pawoon_transactions, pawoon_categories, pawoon_outlets, pawoon_products CASCADE;
-- ============================================================

CREATE TABLE pawoon_outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pawoon_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT true,
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pawoon_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pawoon_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pawoon_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pawoon_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category_name VARCHAR(100),
    pawoon_category_id VARCHAR(50),
    price DECIMAL(15, 2) DEFAULT 0,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    is_sold BOOLEAN DEFAULT true,
    outlet_ids JSONB,
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pawoon_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pawoon_id VARCHAR(50) UNIQUE NOT NULL,
    pawoon_outlet_id VARCHAR(50) NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    total_amount DECIMAL(15, 2),
    payment_method VARCHAR(50),
    items JSONB NOT NULL,
    customer_name VARCHAR(255),
    channel VARCHAR(50),
    session VARCHAR(20) CHECK (
        session IS NULL
        OR session IN ('breakfast', 'lunch', 'dinner', 'late_night')
    ),
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pawoon_stock_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pawoon_outlet_id VARCHAR(50) NOT NULL,
    pawoon_product_id VARCHAR(50) NOT NULL,
    period_date DATE NOT NULL,
    stok_awal DECIMAL(15, 3) DEFAULT 0,
    masuk DECIMAL(15, 3) DEFAULT 0,
    keluar DECIMAL(15, 3) DEFAULT 0,
    penjualan DECIMAL(15, 3) DEFAULT 0,
    transfer DECIMAL(15, 3) DEFAULT 0,
    penyesuaian DECIMAL(15, 3) DEFAULT 0,
    stok_akhir DECIMAL(15, 3) DEFAULT 0,
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pawoon_outlet_id, pawoon_product_id, period_date)
);

CREATE TABLE pawoon_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    records_synced INT DEFAULT 0,
    duration_ms INT,
    status VARCHAR(20) CHECK (status IN ('success', 'partial', 'failed')),
    error TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
