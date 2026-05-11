-- ============================================================
-- Migration 006 — Functions & triggers (auto-updated_at + recipe COGS)
-- Reverse: drop all triggers + functions defined here.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'pawoon_outlets', 'pawoon_categories', 'pawoon_products', 'pawoon_stock_cards',
        'user_profiles',
        'os_suppliers', 'os_bahan_baku', 'os_raw_menu', 'os_recipes', 'os_master_menu',
        'os_purchase_orders', 'os_deliveries', 'os_billing'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_update_timestamp BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp()',
            t
        );
    END LOOP;
END $$;

-- Recalculate recipe COGS whenever recipe items change.
CREATE OR REPLACE FUNCTION fn_recalculate_recipe_cogs()
RETURNS TRIGGER AS $$
DECLARE
    v_recipe_id VARCHAR(20);
    v_total DECIMAL(15, 2);
    v_jumlah_hasil DECIMAL(15, 3);
BEGIN
    v_recipe_id := COALESCE(NEW.recipe_id, OLD.recipe_id);

    SELECT COALESCE(SUM(cost), 0) INTO v_total
    FROM os_recipe_items
    WHERE recipe_id = v_recipe_id;

    SELECT jumlah_hasil INTO v_jumlah_hasil
    FROM os_recipes
    WHERE id = v_recipe_id;

    UPDATE os_recipes
    SET total_cogs = v_total,
        cogs_per_unit = CASE WHEN v_jumlah_hasil > 0 THEN v_total / v_jumlah_hasil ELSE 0 END,
        updated_at = NOW()
    WHERE id = v_recipe_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recipe_items_cogs
AFTER INSERT OR UPDATE OR DELETE ON os_recipe_items
FOR EACH ROW EXECUTE FUNCTION fn_recalculate_recipe_cogs();

-- Same logic for raw_menu (SFG)
CREATE OR REPLACE FUNCTION fn_recalculate_raw_menu_cogs()
RETURNS TRIGGER AS $$
DECLARE
    v_raw_menu_id VARCHAR(20);
    v_total DECIMAL(15, 2);
    v_jumlah_hasil DECIMAL(15, 3);
BEGIN
    v_raw_menu_id := COALESCE(NEW.raw_menu_id, OLD.raw_menu_id);

    SELECT COALESCE(SUM(cost), 0) INTO v_total
    FROM os_raw_menu_items
    WHERE raw_menu_id = v_raw_menu_id;

    SELECT jumlah_hasil INTO v_jumlah_hasil
    FROM os_raw_menu
    WHERE id = v_raw_menu_id;

    UPDATE os_raw_menu
    SET total_cogs = v_total,
        cogs_per_unit = CASE WHEN v_jumlah_hasil > 0 THEN v_total / v_jumlah_hasil ELSE 0 END,
        updated_at = NOW()
    WHERE id = v_raw_menu_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_raw_menu_items_cogs
AFTER INSERT OR UPDATE OR DELETE ON os_raw_menu_items
FOR EACH ROW EXECUTE FUNCTION fn_recalculate_raw_menu_cogs();
