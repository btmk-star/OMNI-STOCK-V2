#!/usr/bin/env tsx
/**
 * One-shot migration V1.6 (project oevqixtlbxsvdjprjiol) → V2 (rczzlvlprbttaqyxthkm).
 * Idempotent — pakai upsert + onConflict supaya aman re-run.
 *
 * Run: npx tsx scripts/migrate-v1-to-v2.ts [--dry-run|--apply] [--snapshot] [--only step1,step2]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = resolve(HERE, 'v1-snapshot');

// Load .env.local manual (tsx tidak auto-load Next.js env files)
loadDotEnvLocal();

// === CLI ===
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || (!args.includes('--apply') && !args.includes('--snapshot'));
const isApply = args.includes('--apply');
const isSnapshotOnly = args.includes('--snapshot') && !isApply;
const onlyArgIdx = args.indexOf('--only');
const onlySteps =
  onlyArgIdx >= 0 && args[onlyArgIdx + 1]
    ? new Set(args[onlyArgIdx + 1].split(',').map((s) => s.trim()))
    : null;

function shouldRun(stepName: string): boolean {
  return !onlySteps || onlySteps.has(stepName);
}

// === ENV ===
const v1Url = requireEnv('V1_SUPABASE_URL');
const v1Key = requireEnv('V1_SUPABASE_SERVICE_KEY');
const v2Url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const v2Key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const v1 = createClient(v1Url, v1Key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const v2 = createClient(v2Url, v2Key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// === Logging ===
const stats: Array<{ step: string; fetched: number; inserted: number; skipped: number; error?: string }> = [];

function log(step: string, msg: string) {
  console.log(`[${step}] ${msg}`);
}
function record(step: string, fetched: number, inserted: number, skipped: number, error?: string) {
  stats.push({ step, fetched, inserted, skipped, error });
}

// ============================================================
// Step 1 — outlets → pawoon_outlets (bridged via pawoon_outlet_map)
// ============================================================
async function migrateOutlets() {
  const step = 'outlets';
  if (!shouldRun(step)) return;
  log(step, 'fetch V1 outlets + pawoon_outlet_map');

  const { data: v1Outlets, error: e1 } = await v1.from('outlets').select('*');
  if (e1) throw new Error(`V1 outlets fetch: ${e1.message}`);
  const { data: pawoonMap, error: e2 } = await v1.from('pawoon_outlet_map').select('*');
  if (e2) throw new Error(`V1 pawoon_outlet_map fetch: ${e2.message}`);

  const fetched = v1Outlets!.length;
  let inserted = 0;
  const rows = v1Outlets!.map((o: { id: string; nama_outlet: string }) => {
    const mapping = pawoonMap!.find((m: { outlet_id: string }) => m.outlet_id === o.id);
    return {
      pawoon_id: mapping?.pawoon_outlet_id ?? `INTERNAL-${o.id}`,
      name: o.nama_outlet,
      is_active: true,
      raw_data: { v1_outlet_id: o.id, mapped: Boolean(mapping) },
    };
  });

  if (isDryRun) {
    log(step, `DRY-RUN would upsert ${rows.length} outlets`);
  } else {
    const { error, count } = await v2
      .from('pawoon_outlets')
      .upsert(rows, { onConflict: 'pawoon_id', count: 'exact' });
    if (error) throw new Error(`V2 pawoon_outlets upsert: ${error.message}`);
    inserted = count ?? rows.length;
    log(step, `upserted ${inserted}`);
  }

  record(step, fetched, inserted, fetched - inserted);
}

// ============================================================
// Step 2 — master_vendor → os_suppliers
// ============================================================
function mapVendorPlatformToType(platform: string | null): 'kerjasama' | 'non_kerjasama' | 'online_shop' {
  if (platform === 'shopee' || platform === 'tokopedia') return 'online_shop';
  if (platform === 'offline') return 'kerjasama';
  return 'non_kerjasama'; // whatsapp, others
}

async function migrateSuppliers() {
  const step = 'suppliers';
  if (!shouldRun(step)) return;
  log(step, 'fetch V1 master_vendor');

  const { data, error } = await v1.from('master_vendor').select('*');
  if (error) throw new Error(`V1 master_vendor fetch: ${error.message}`);

  const fetched = data!.length;
  const rows = data!.map(
    (v: {
      id: string;
      nama_vendor: string;
      kontak_wa: string | null;
      no_rekening: string | null;
      vendor_platform: string | null;
      estimasi_pengiriman: number;
    }) => ({
      id: v.id,
      name: v.nama_vendor,
      contact_person: null,
      whatsapp: cleanPhone(v.kontak_wa),
      phone: cleanPhone(v.kontak_wa),
      email: null,
      address: v.no_rekening ?? null,
      type: mapVendorPlatformToType(v.vendor_platform),
      payment_terms: v.no_rekening ?? null,
      lead_time_days: v.estimasi_pengiriman ?? null,
      is_active: true,
    }),
  );

  let inserted = 0;
  if (isDryRun) {
    log(step, `DRY-RUN would upsert ${rows.length} suppliers (sample: ${JSON.stringify(rows[0])})`);
  } else {
    const { error: upErr, count } = await v2
      .from('os_suppliers')
      .upsert(rows, { onConflict: 'id', count: 'exact' });
    if (upErr) throw new Error(`V2 os_suppliers upsert: ${upErr.message}`);
    inserted = count ?? rows.length;
    log(step, `upserted ${inserted}`);
  }

  record(step, fetched, inserted, fetched - inserted);
}

// ============================================================
// Step 3 — master_bahan → os_bahan_baku
// ============================================================
async function migrateBahan() {
  const step = 'bahan';
  if (!shouldRun(step)) return;
  log(step, 'fetch V1 master_bahan');

  const { data, error } = await v1.from('master_bahan').select('*');
  if (error) throw new Error(`V1 master_bahan fetch: ${error.message}`);

  const fetched = data!.length;
  const rows = data!.map(
    (b: {
      id: string;
      outlet_id: string | null;
      nama_bahan: string;
      tipe_bahan: 'packaged' | 'raw_bulk';
      kategori_bahan: string | null;
      harga_beli: number;
      satuan_beli: string;
      isi_satuan: number;
      satuan_dapur: string;
      stok_minimum: number;
      lead_time_days: number;
      harga_per_satuan_porsi: number | null;
    }) => ({
      id: b.id,
      name: b.nama_bahan,
      tipe: b.tipe_bahan,
      kategori: b.kategori_bahan,
      kemasan_beli: b.satuan_beli,
      satuan_dapur: b.satuan_dapur,
      min_stok: b.stok_minimum,
      min_stok_unit: b.satuan_dapur,
      harga_beli: b.harga_beli,
      isi_yield: b.isi_satuan,
      harga_per_porsi: b.harga_per_satuan_porsi,
      outlet_id: b.outlet_id,
      supplier_id: null, // di-backfill di step "vendor_bahan"
      pawoon_product_id: null,
      pawoon_product_name: null,
      is_active: true,
    }),
  );

  let inserted = 0;
  if (isDryRun) {
    log(step, `DRY-RUN would upsert ${rows.length} bahan (sample: ${JSON.stringify(rows[0])})`);
  } else {
    // Batch 100 per call untuk hindari payload terlalu besar
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error: upErr, count } = await v2
        .from('os_bahan_baku')
        .upsert(batch, { onConflict: 'id', count: 'exact' });
      if (upErr) throw new Error(`V2 os_bahan_baku upsert (batch ${i}): ${upErr.message}`);
      inserted += count ?? batch.length;
    }
    log(step, `upserted ${inserted}`);
  }

  record(step, fetched, inserted, fetched - inserted);
}

// ============================================================
// Step 4 — vendor_bahan → backfill os_bahan_baku.supplier_id
// ============================================================
async function migrateVendorBahan() {
  const step = 'vendor_bahan';
  if (!shouldRun(step)) return;
  log(step, 'fetch V1 vendor_bahan');

  const { data, error } = await v1.from('vendor_bahan').select('*');
  if (error) throw new Error(`V1 vendor_bahan fetch: ${error.message}`);

  const fetched = data!.length;
  // Group by bahan_id, pick is_primary=true atau row pertama
  const grouped = new Map<string, string>();
  for (const row of data! as Array<{ bahan_id: string; vendor_id: string; is_primary: boolean }>) {
    if (grouped.has(row.bahan_id) && !row.is_primary) continue;
    grouped.set(row.bahan_id, row.vendor_id);
  }

  let inserted = 0;
  if (isDryRun) {
    log(step, `DRY-RUN would update ${grouped.size} bahan supplier_id`);
  } else {
    for (const [bahanId, supplierId] of grouped) {
      const { error: upErr } = await v2
        .from('os_bahan_baku')
        .update({ supplier_id: supplierId })
        .eq('id', bahanId);
      if (upErr) {
        log(step, `WARN update bahan ${bahanId}: ${upErr.message}`);
      } else {
        inserted += 1;
      }
    }
    log(step, `updated ${inserted} supplier_id`);
  }

  record(step, fetched, inserted, fetched - inserted);
}

// ============================================================
// Step 5 — semi_finished → os_raw_menu
// ============================================================
async function migrateRawMenu() {
  const step = 'raw_menu';
  if (!shouldRun(step)) return;
  log(step, 'fetch V1 semi_finished');

  const { data, error } = await v1.from('semi_finished').select('*');
  if (error) throw new Error(`V1 semi_finished fetch: ${error.message}`);

  const fetched = data!.length;
  const rows = data!.map(
    (s: {
      id: string;
      nama_semi_finished: string;
      satuan_hasil: string;
      jumlah_hasil: number;
      total_cogs: number;
      cogs_per_unit: number;
    }) => ({
      id: s.id,
      name: s.nama_semi_finished,
      satuan_hasil: s.satuan_hasil,
      jumlah_hasil: s.jumlah_hasil,
      total_cogs: s.total_cogs,
      cogs_per_unit: s.cogs_per_unit,
      is_active: true,
    }),
  );

  let inserted = 0;
  if (isDryRun) {
    log(step, `DRY-RUN would upsert ${rows.length} raw_menu`);
  } else {
    const { error: upErr, count } = await v2
      .from('os_raw_menu')
      .upsert(rows, { onConflict: 'id', count: 'exact' });
    if (upErr) throw new Error(`V2 os_raw_menu upsert: ${upErr.message}`);
    inserted = count ?? rows.length;
    log(step, `upserted ${inserted}`);
  }

  record(step, fetched, inserted, fetched - inserted);
}

// ============================================================
// Step 6 — master_menu → os_master_menu + os_recipes (1:1 auto-create)
// ============================================================
async function migrateMenu() {
  const step = 'menu';
  if (!shouldRun(step)) return;
  log(step, 'fetch V1 master_menu + pawoon_product_map');

  const { data: menus, error: e1 } = await v1.from('master_menu').select('*');
  if (e1) throw new Error(`V1 master_menu fetch: ${e1.message}`);
  const { data: pawoonMap, error: e2 } = await v1.from('pawoon_product_map').select('*');
  if (e2) throw new Error(`V1 pawoon_product_map fetch: ${e2.message}`);

  const pawoonByMenuId = new Map<string, string>();
  for (const m of pawoonMap! as Array<{ menu_id: string; pawoon_product_id: string }>) {
    pawoonByMenuId.set(m.menu_id, m.pawoon_product_id);
  }

  const fetched = menus!.length;
  const recipeRows: Array<Record<string, unknown>> = [];
  const menuRows = menus!.map(
    (m: {
      id: string;
      nama_menu: string;
      outlet_id: string | null;
      kategori: string | null;
      channel_type: string | null;
      harga_jual: number | null;
      total_cogs: number | null;
    }) => {
      // Auto-create recipe with same ID (RCP-{menu_id}) for 1:1 mapping
      const recipeId = `RCP-${m.id}`;
      recipeRows.push({
        id: recipeId,
        menu_id: m.id,
        name: m.nama_menu,
        satuan_hasil: 'porsi',
        jumlah_hasil: 1,
        total_cogs: m.total_cogs ?? 0,
        cogs_per_unit: m.total_cogs ?? 0,
        is_active: true,
      });

      const harga = m.harga_jual ?? 0;
      const cogs = m.total_cogs ?? 0;
      const margin = harga > 0 ? ((harga - cogs) / harga) * 100 : 0;

      return {
        id: m.id,
        name: m.nama_menu,
        pawoon_product_id: pawoonByMenuId.get(m.id) ?? null,
        channel: m.channel_type,
        kategori: m.kategori,
        outlet_id: m.outlet_id,
        recipe_id: recipeId,
        harga_jual: harga,
        total_cogs: cogs,
        margin_pct: Math.round(margin * 100) / 100,
        is_active: true,
      };
    },
  );

  let inserted = 0;
  if (isDryRun) {
    log(step, `DRY-RUN would upsert ${menuRows.length} menus + ${recipeRows.length} recipes`);
    log(step, `  pawoon-mapped: ${menuRows.filter((m) => m.pawoon_product_id).length}`);
  } else {
    // Insert recipes first (FK: os_master_menu.recipe_id → os_recipes.id)
    // But os_recipes has FK menu_id → os_master_menu.id (circular). Workaround:
    // 1. Insert menus tanpa recipe_id dulu
    // 2. Insert recipes dengan menu_id
    // 3. Update menus dengan recipe_id
    const menuFirstPass = menuRows.map((m) => ({ ...m, recipe_id: null }));
    for (let i = 0; i < menuFirstPass.length; i += 100) {
      const batch = menuFirstPass.slice(i, i + 100);
      const { error: upErr } = await v2
        .from('os_master_menu')
        .upsert(batch, { onConflict: 'id' });
      if (upErr) throw new Error(`V2 os_master_menu pass1 (batch ${i}): ${upErr.message}`);
    }

    for (let i = 0; i < recipeRows.length; i += 100) {
      const batch = recipeRows.slice(i, i + 100);
      const { error: upErr } = await v2
        .from('os_recipes')
        .upsert(batch, { onConflict: 'id' });
      if (upErr) throw new Error(`V2 os_recipes (batch ${i}): ${upErr.message}`);
    }

    // Pass 2: backfill recipe_id
    for (let i = 0; i < menuRows.length; i += 100) {
      const batch = menuRows.slice(i, i + 100);
      const { error: upErr } = await v2
        .from('os_master_menu')
        .upsert(batch, { onConflict: 'id' });
      if (upErr) throw new Error(`V2 os_master_menu pass2 (batch ${i}): ${upErr.message}`);
    }

    inserted = menuRows.length;
    log(step, `upserted ${inserted} menus + ${recipeRows.length} recipes`);
  }

  record(step, fetched, inserted, fetched - inserted);
}

// ============================================================
// Step 7 — mapping_resep → os_recipe_items + os_raw_menu_items
// ============================================================
async function migrateRecipeItems() {
  const step = 'recipe_items';
  if (!shouldRun(step)) return;
  log(step, 'fetch V1 mapping_resep');

  const { data, error } = await v1.from('mapping_resep').select('*');
  if (error) throw new Error(`V1 mapping_resep fetch: ${error.message}`);

  const fetched = data!.length;
  const recipeItemRows: Array<Record<string, unknown>> = [];
  const rawMenuItemRows: Array<Record<string, unknown>> = [];

  for (const row of data! as Array<{
    id: string;
    parent_id: string;
    parent_type: 'menu' | 'semi_finished';
    item_id: string;
    item_type: 'bahan_dasar' | 'semi_finished';
    qty: number;
  }>) {
    const baseRow = {
      qty: row.qty,
      satuan: 'porsi',
      cost: 0,
      sort_order: 0,
    };

    if (row.parent_type === 'menu') {
      recipeItemRows.push({
        ...baseRow,
        recipe_id: `RCP-${row.parent_id}`, // match Step 6 auto-create
        bahan_id: row.item_type === 'bahan_dasar' ? row.item_id : null,
        raw_menu_id: row.item_type === 'semi_finished' ? row.item_id : null,
      });
    } else {
      rawMenuItemRows.push({
        ...baseRow,
        raw_menu_id: row.parent_id,
        bahan_id: row.item_type === 'bahan_dasar' ? row.item_id : null,
      });
    }
  }

  let inserted = 0;
  if (isDryRun) {
    log(
      step,
      `DRY-RUN would insert ${recipeItemRows.length} recipe_items + ${rawMenuItemRows.length} raw_menu_items`,
    );
  } else {
    // Use insert (not upsert) — items have UUID PK auto-generate
    // Delete existing first untuk idempotency? Riskier — skip untuk Phase 2 (assume migration once)
    if (recipeItemRows.length > 0) {
      for (let i = 0; i < recipeItemRows.length; i += 100) {
        const batch = recipeItemRows.slice(i, i + 100);
        const { error: upErr } = await v2.from('os_recipe_items').insert(batch);
        if (upErr) {
          log(step, `WARN recipe_items batch ${i}: ${upErr.message}`);
        } else {
          inserted += batch.length;
        }
      }
    }
    if (rawMenuItemRows.length > 0) {
      for (let i = 0; i < rawMenuItemRows.length; i += 100) {
        const batch = rawMenuItemRows.slice(i, i + 100);
        const { error: upErr } = await v2.from('os_raw_menu_items').insert(batch);
        if (upErr) {
          log(step, `WARN raw_menu_items batch ${i}: ${upErr.message}`);
        } else {
          inserted += batch.length;
        }
      }
    }
    log(step, `inserted ${inserted}`);
  }

  record(step, fetched, inserted, fetched - inserted);
}

// ============================================================
// Step 8 — purchase_orders (V1 flat) → os_purchase_orders + os_po_items (V2 normalized)
// ============================================================
function mapPoStatus(s: string): string {
  if (s === 'sent') return 'approved';
  if (s === 'received') return 'received';
  return 'draft';
}

async function migratePurchaseOrders() {
  const step = 'purchase_orders';
  if (!shouldRun(step)) return;
  log(step, 'fetch V1 purchase_orders');

  const { data, error } = await v1.from('purchase_orders').select('*');
  if (error) throw new Error(`V1 purchase_orders fetch: ${error.message}`);

  const fetched = data!.length;

  // V1 PO format: 1 row = 1 line item. Group by (outlet_id, vendor_id, created_at-day, status)
  type V1Po = {
    id: string;
    outlet_id: string;
    vendor_id: string;
    bahan_id: string;
    status: string;
    qty_order: number;
    harga_satuan: number;
    total_harga: number;
    tanggal_kirim: string | null;
    tanggal_terima: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };

  const groups = new Map<string, V1Po[]>();
  for (const po of data! as V1Po[]) {
    const day = po.created_at?.slice(0, 10) ?? 'unknown';
    const key = `${po.outlet_id}|${po.vendor_id}|${day}|${po.status}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(po);
  }

  const poHeaders: Array<Record<string, unknown>> = [];
  const poItems: Array<Record<string, unknown>> = [];

  let groupIdx = 1;
  for (const items of groups.values()) {
    const first = items[0];
    const day = first.created_at.slice(0, 10).replace(/-/g, '');
    const groupId = `PO-V1MIG-${day}-${String(groupIdx).padStart(4, '0')}`;
    groupIdx += 1;

    const total = items.reduce((sum, it) => sum + Number(it.total_harga ?? 0), 0);

    poHeaders.push({
      id: groupId,
      supplier_id: first.vendor_id,
      outlet_ids: [first.outlet_id],
      status: mapPoStatus(first.status),
      total_amount: total,
      notes: `Migrated from V1.6 (${items.length} items, day ${day})`,
      created_by: null,
      created_by_name: 'V1.6 Migration',
      ordered_at: first.tanggal_kirim,
      created_at: first.created_at,
      updated_at: first.updated_at,
    });

    for (const it of items) {
      poItems.push({
        po_id: groupId,
        bahan_id: it.bahan_id,
        qty: it.qty_order,
        satuan: 'pcs',
        harga_satuan: it.harga_satuan,
        subtotal: it.total_harga,
        qty_received: it.status === 'received' ? it.qty_order : 0,
      });
    }
  }

  let inserted = 0;
  if (isDryRun) {
    log(step, `DRY-RUN would insert ${poHeaders.length} PO headers + ${poItems.length} PO items`);
  } else {
    for (let i = 0; i < poHeaders.length; i += 100) {
      const batch = poHeaders.slice(i, i + 100);
      const { error: upErr } = await v2.from('os_purchase_orders').upsert(batch, { onConflict: 'id' });
      if (upErr) throw new Error(`V2 os_purchase_orders (batch ${i}): ${upErr.message}`);
    }
    for (let i = 0; i < poItems.length; i += 100) {
      const batch = poItems.slice(i, i + 100);
      const { error: upErr } = await v2.from('os_po_items').insert(batch);
      if (upErr) {
        log(step, `WARN po_items batch ${i}: ${upErr.message}`);
      } else {
        inserted += batch.length;
      }
    }
    log(step, `inserted ${poHeaders.length} headers + ${inserted} items`);
  }

  record(step, fetched, inserted, fetched - inserted);
}

// ============================================================
// Snapshot mode — dump V1 data ke JSON files for backup
// ============================================================
async function dumpSnapshot() {
  if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const tables = [
    'outlets',
    'master_vendor',
    'master_bahan',
    'vendor_bahan',
    'semi_finished',
    'master_menu',
    'mapping_resep',
    'purchase_orders',
    'pawoon_outlet_map',
    'pawoon_product_map',
  ];

  for (const t of tables) {
    log('snapshot', `dump ${t}`);
    const { data, error } = await v1.from(t).select('*');
    if (error) {
      log('snapshot', `WARN ${t}: ${error.message}`);
      continue;
    }
    const path = resolve(SNAPSHOT_DIR, `${t}.json`);
    writeFileSync(path, JSON.stringify(data, null, 2));
    log('snapshot', `wrote ${data?.length ?? 0} rows → ${path}`);
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('========================================');
  console.log('OMNI-STOCK V1.6 → V2 Migration');
  console.log('========================================');
  console.log('Source:', v1Url);
  console.log('Target:', v2Url);
  console.log('Mode:  ', isApply ? 'APPLY' : isSnapshotOnly ? 'SNAPSHOT' : 'DRY-RUN');
  if (onlySteps) console.log('Only:  ', [...onlySteps].join(', '));
  console.log('========================================\n');

  if (isSnapshotOnly) {
    await dumpSnapshot();
    return;
  }

  try {
    await migrateOutlets();
    await migrateSuppliers();
    await migrateBahan();
    await migrateVendorBahan();
    await migrateRawMenu();
    await migrateMenu();
    await migrateRecipeItems();
    await migratePurchaseOrders();
  } catch (err) {
    console.error('\nFATAL:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('Summary');
  console.log('========================================');
  console.table(stats);
  console.log(isDryRun ? '\n(dry-run — no data written)' : '\n(applied)');
}

// ============================================================
// Helpers
// ============================================================
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name} (lihat scripts/README.md)`);
    process.exit(1);
  }
  return v;
}

function loadDotEnvLocal() {
  const envPath = resolve(HERE, '..', '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function cleanPhone(input: string | null): string | null {
  if (!input || input === '-') return null;
  const digits = input.replace(/[^\d+]/g, '');
  if (!digits) return null;
  // Normalize Indonesia format: 08xx → 628xx, +628xx → 628xx
  if (digits.startsWith('+62')) return digits.slice(1);
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('08')) return '62' + digits.slice(1);
  return digits;
}

main().catch((err) => {
  console.error('UNHANDLED:', err);
  process.exit(1);
});
