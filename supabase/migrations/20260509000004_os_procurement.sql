-- ============================================================
-- Migration 004 — OMNI-STOCK Procurement (PO, delivery, billing)
-- Reverse: DROP TABLE os_billing, os_delivery_items, os_deliveries, os_po_logs, os_po_items, os_purchase_orders CASCADE;
-- ============================================================

CREATE TABLE os_purchase_orders (
    id VARCHAR(20) PRIMARY KEY,
    supplier_id VARCHAR(20) REFERENCES os_suppliers (id) ON DELETE RESTRICT,
    outlet_ids JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (
        status IN (
            'draft', 'submitted', 'approved', 'ordered',
            'partial_received', 'received', 'wa_sent', 'cancelled'
        )
    ),
    total_amount DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_by_name VARCHAR(255),
    approved_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    ordered_at TIMESTAMPTZ,
    expected_delivery DATE,
    wa_template_text TEXT,
    wa_sent_at TIMESTAMPTZ,
    wa_sent_to VARCHAR(20),
    wa_send_method VARCHAR(20) CHECK (
        wa_send_method IS NULL
        OR wa_send_method IN ('deeplink', 'fonnte', 'kirimchat')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id VARCHAR(20) NOT NULL REFERENCES os_purchase_orders (id) ON DELETE CASCADE,
    bahan_id VARCHAR(20) REFERENCES os_bahan_baku (id) ON DELETE RESTRICT,
    qty DECIMAL(15, 3) NOT NULL,
    satuan VARCHAR(50),
    harga_satuan DECIMAL(15, 2),
    subtotal DECIMAL(15, 2),
    qty_received DECIMAL(15, 3) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_po_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id VARCHAR(20) NOT NULL REFERENCES os_purchase_orders (id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    actor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    actor_role VARCHAR(20),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_deliveries (
    id VARCHAR(20) PRIMARY KEY,
    po_id VARCHAR(20) REFERENCES os_purchase_orders (id) ON DELETE RESTRICT,
    supplier_id VARCHAR(20) REFERENCES os_suppliers (id) ON DELETE SET NULL,
    outlet_id VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending', 'in_transit', 'arrived', 'inspected',
            'accepted', 'partial_accepted', 'rejected'
        )
    ),
    received_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ,
    notes TEXT,
    pushed_to_pawoon BOOLEAN DEFAULT false,
    pawoon_push_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_delivery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id VARCHAR(20) NOT NULL REFERENCES os_deliveries (id) ON DELETE CASCADE,
    po_item_id UUID REFERENCES os_po_items (id) ON DELETE SET NULL,
    bahan_id VARCHAR(20) REFERENCES os_bahan_baku (id) ON DELETE RESTRICT,
    qty_expected DECIMAL(15, 3),
    qty_received DECIMAL(15, 3),
    qty_rejected DECIMAL(15, 3) DEFAULT 0,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id VARCHAR(20) NOT NULL REFERENCES os_purchase_orders (id) ON DELETE RESTRICT,
    supplier_id VARCHAR(20) REFERENCES os_suppliers (id) ON DELETE SET NULL,
    invoice_number VARCHAR(50),
    invoice_date DATE,
    amount DECIMAL(15, 2) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (
        payment_status IN ('unpaid', 'paid', 'overdue', 'partial')
    ),
    payment_method VARCHAR(50),
    paid_at TIMESTAMPTZ,
    paid_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
