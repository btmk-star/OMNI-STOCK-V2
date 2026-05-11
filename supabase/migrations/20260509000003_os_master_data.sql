-- ============================================================
-- Migration 003 — OMNI-STOCK Master Data (suppliers, bahan, recipes, menu)
-- Reverse: DROP TABLE os_master_menu, os_recipe_items, os_recipes, os_raw_menu_items, os_raw_menu, os_bahan_baku, os_suppliers CASCADE;
-- ============================================================

CREATE TABLE os_suppliers (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    whatsapp VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    type VARCHAR(20) NOT NULL CHECK (
        type IN ('kerjasama', 'non_kerjasama', 'online_shop')
    ),
    payment_terms VARCHAR(50),
    lead_time_days INT,
    rating DECIMAL(3, 1),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_bahan_baku (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tipe VARCHAR(20) NOT NULL CHECK (tipe IN ('packaged', 'raw_bulk')),
    kategori VARCHAR(100),
    kemasan_beli VARCHAR(50),
    satuan_dapur VARCHAR(20),
    min_stok DECIMAL(15, 3),
    min_stok_unit VARCHAR(20),
    harga_beli DECIMAL(15, 2),
    isi_yield DECIMAL(15, 3),
    harga_per_porsi DECIMAL(15, 2),
    outlet_id VARCHAR(20),
    supplier_id VARCHAR(20) REFERENCES os_suppliers (id) ON DELETE SET NULL,
    pawoon_product_id VARCHAR(50),
    pawoon_product_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_raw_menu (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    satuan_hasil VARCHAR(50),
    jumlah_hasil DECIMAL(15, 3) DEFAULT 1,
    total_cogs DECIMAL(15, 2),
    cogs_per_unit DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_raw_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_menu_id VARCHAR(20) NOT NULL REFERENCES os_raw_menu (id) ON DELETE CASCADE,
    bahan_id VARCHAR(20) REFERENCES os_bahan_baku (id) ON DELETE RESTRICT,
    qty DECIMAL(15, 3) NOT NULL,
    satuan VARCHAR(20),
    cost DECIMAL(15, 2),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_recipes (
    id VARCHAR(20) PRIMARY KEY,
    menu_id VARCHAR(20),
    name VARCHAR(255) NOT NULL,
    satuan_hasil VARCHAR(50),
    jumlah_hasil DECIMAL(15, 3) DEFAULT 1,
    total_cogs DECIMAL(15, 2),
    cogs_per_unit DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id VARCHAR(20) NOT NULL REFERENCES os_recipes (id) ON DELETE CASCADE,
    bahan_id VARCHAR(20) REFERENCES os_bahan_baku (id) ON DELETE RESTRICT,
    raw_menu_id VARCHAR(20) REFERENCES os_raw_menu (id) ON DELETE RESTRICT,
    qty DECIMAL(15, 3) NOT NULL,
    satuan VARCHAR(20),
    cost DECIMAL(15, 2),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (bahan_id IS NOT NULL AND raw_menu_id IS NULL)
        OR (bahan_id IS NULL AND raw_menu_id IS NOT NULL)
    )
);

CREATE TABLE os_master_menu (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pawoon_product_id VARCHAR(50) REFERENCES pawoon_products (pawoon_id) ON DELETE SET NULL,
    channel VARCHAR(50),
    kategori VARCHAR(100),
    outlet_id VARCHAR(20),
    recipe_id VARCHAR(20) REFERENCES os_recipes (id) ON DELETE SET NULL,
    harga_jual DECIMAL(15, 2),
    total_cogs DECIMAL(15, 2),
    margin_pct DECIMAL(5, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE os_recipes
ADD CONSTRAINT fk_os_recipes_menu_id
FOREIGN KEY (menu_id) REFERENCES os_master_menu (id) ON DELETE SET NULL;
