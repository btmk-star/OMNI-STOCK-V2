-- ============================================================
-- Migration 005 — Intelligence + adjustments + notifications + n8n logs
-- Reverse: DROP TABLE n8n_error_logs, os_notifications, os_stock_adjustments, os_ai_predictions;
-- ============================================================

CREATE TABLE os_ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_type VARCHAR(50) NOT NULL,
    outlet_id VARCHAR(20),
    target_date DATE,
    input_data JSONB,
    prediction JSONB,
    confidence DECIMAL(5, 2),
    model_version VARCHAR(50),
    input_tokens INT,
    output_tokens INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE os_stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bahan_id VARCHAR(20) REFERENCES os_bahan_baku (id) ON DELETE RESTRICT,
    outlet_id VARCHAR(20),
    adjustment_type VARCHAR(30) NOT NULL CHECK (
        adjustment_type IN ('opname', 'reconciliation', 'manual', 'damage', 'transfer')
    ),
    qty_before DECIMAL(15, 3),
    qty_after DECIMAL(15, 3),
    qty_diff DECIMAL(15, 3),
    reason TEXT,
    adjusted_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    adjusted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(50) NOT NULL,
    event VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'email', 'in_app')),
    target VARCHAR(255),
    payload JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'sent', 'failed', 'skipped')
    ),
    error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE n8n_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow VARCHAR(100),
    node VARCHAR(100),
    error TEXT,
    stack TEXT,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
