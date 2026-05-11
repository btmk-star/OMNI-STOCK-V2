-- ============================================================
-- Migration 007 — Row Level Security policies
-- All app tables must have RLS enabled. Service role bypasses RLS for n8n + Server Actions.
-- Phase 1 baseline: authenticated users can read everything; mutations gated by role helper.
-- Reverse: drop all policies; ALTER TABLE ... DISABLE ROW LEVEL SECURITY.
-- ============================================================

-- Helper: read role of current user (used by policies below).
CREATE OR REPLACE FUNCTION fn_current_role()
RETURNS TEXT AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'pawoon_outlets', 'pawoon_categories', 'pawoon_products',
        'pawoon_transactions', 'pawoon_stock_cards', 'pawoon_sync_log',
        'user_profiles',
        'os_suppliers', 'os_bahan_baku', 'os_raw_menu', 'os_raw_menu_items',
        'os_recipes', 'os_recipe_items', 'os_master_menu',
        'os_purchase_orders', 'os_po_items', 'os_po_logs',
        'os_deliveries', 'os_delivery_items', 'os_billing',
        'os_ai_predictions', 'os_stock_adjustments', 'os_notifications',
        'n8n_error_logs'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- ============================================================
-- user_profiles: each user can read/update own profile; admin can do everything.
-- ============================================================
CREATE POLICY user_profiles_self_read
    ON user_profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR fn_current_role() IN ('admin', 'manager'));

CREATE POLICY user_profiles_self_update
    ON user_profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY user_profiles_admin_all
    ON user_profiles FOR ALL TO authenticated
    USING (fn_current_role() = 'admin')
    WITH CHECK (fn_current_role() = 'admin');

-- ============================================================
-- Pawoon sync layer: read-only for all authenticated users.
-- (Writes happen via service role from n8n; service role bypasses RLS.)
-- ============================================================
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'pawoon_outlets', 'pawoon_categories', 'pawoon_products',
        'pawoon_transactions', 'pawoon_stock_cards', 'pawoon_sync_log'
    ]
    LOOP
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
            t || '_read', t
        );
    END LOOP;
END $$;

-- ============================================================
-- OMNI-STOCK master & procurement: authenticated read; role-gated writes.
-- Detailed per-action policies will be tightened in Phase 3 when modules go live.
-- ============================================================
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'os_suppliers', 'os_bahan_baku', 'os_raw_menu', 'os_raw_menu_items',
        'os_recipes', 'os_recipe_items', 'os_master_menu',
        'os_purchase_orders', 'os_po_items', 'os_po_logs',
        'os_deliveries', 'os_delivery_items', 'os_billing',
        'os_ai_predictions', 'os_stock_adjustments', 'os_notifications',
        'n8n_error_logs'
    ]
    LOOP
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
            t || '_read', t
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (fn_current_role() IN (''admin'',''manager'',''spv'',''senior_staff''))',
            t || '_insert', t
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (fn_current_role() IN (''admin'',''manager'',''spv'',''senior_staff'')) WITH CHECK (fn_current_role() IN (''admin'',''manager'',''spv'',''senior_staff''))',
            t || '_update', t
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (fn_current_role() IN (''admin'',''manager''))',
            t || '_delete', t
        );
    END LOOP;
END $$;
