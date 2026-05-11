-- ============================================================
-- Migration 008 — Indexes for query patterns called out in Quality Rules §B1.
-- Reverse: DROP INDEX ...
-- ============================================================

-- Pawoon sync layer
CREATE INDEX idx_pawoon_products_pawoon_id ON pawoon_products (pawoon_id);
CREATE INDEX idx_pawoon_products_category ON pawoon_products (pawoon_category_id);
CREATE INDEX idx_pawoon_trx_date ON pawoon_transactions (transaction_date DESC);
CREATE INDEX idx_pawoon_trx_outlet ON pawoon_transactions (pawoon_outlet_id);
CREATE INDEX idx_pawoon_trx_session ON pawoon_transactions (session);
CREATE INDEX idx_pawoon_stock_outlet_product ON pawoon_stock_cards (pawoon_outlet_id, pawoon_product_id);
CREATE INDEX idx_pawoon_sync_log_workflow_date ON pawoon_sync_log (workflow, synced_at DESC);

-- User profiles
CREATE INDEX idx_user_profiles_role ON user_profiles (role);

-- OMNI-STOCK master
CREATE INDEX idx_bahan_supplier ON os_bahan_baku (supplier_id);
CREATE INDEX idx_bahan_outlet ON os_bahan_baku (outlet_id);
CREATE INDEX idx_bahan_pawoon ON os_bahan_baku (pawoon_product_id);
CREATE INDEX idx_bahan_active ON os_bahan_baku (name) WHERE is_active = true;
CREATE INDEX idx_recipe_items_recipe ON os_recipe_items (recipe_id);
CREATE INDEX idx_recipe_items_bahan ON os_recipe_items (bahan_id);
CREATE INDEX idx_raw_menu_items_raw ON os_raw_menu_items (raw_menu_id);
CREATE INDEX idx_master_menu_pawoon ON os_master_menu (pawoon_product_id);
CREATE INDEX idx_master_menu_recipe ON os_master_menu (recipe_id);

-- Procurement
CREATE INDEX idx_po_supplier ON os_purchase_orders (supplier_id);
CREATE INDEX idx_po_status ON os_purchase_orders (status);
CREATE INDEX idx_po_created ON os_purchase_orders (created_at DESC);
CREATE INDEX idx_po_status_date ON os_purchase_orders (status, created_at DESC);
CREATE INDEX idx_po_outlet_ids ON os_purchase_orders USING GIN (outlet_ids);
CREATE INDEX idx_po_items_po ON os_po_items (po_id);
CREATE INDEX idx_po_items_bahan ON os_po_items (bahan_id);
CREATE INDEX idx_po_logs_po ON os_po_logs (po_id, created_at DESC);
CREATE INDEX idx_delivery_po ON os_deliveries (po_id);
CREATE INDEX idx_delivery_status ON os_deliveries (status);
CREATE INDEX idx_delivery_items_delivery ON os_delivery_items (delivery_id);
CREATE INDEX idx_billing_po ON os_billing (po_id);
CREATE INDEX idx_billing_status ON os_billing (payment_status);

-- Intelligence
CREATE INDEX idx_predictions_type_date ON os_ai_predictions (prediction_type, target_date);
CREATE INDEX idx_stock_adj_bahan ON os_stock_adjustments (bahan_id, adjusted_at DESC);
CREATE INDEX idx_notifications_status ON os_notifications (status, created_at DESC);
CREATE INDEX idx_n8n_errors_unresolved ON n8n_error_logs (created_at DESC) WHERE resolved = false;
