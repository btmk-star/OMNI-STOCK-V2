# Scripts

Folder ini berisi one-shot script yang dijalankan **lokal** (tidak deployed). Tidak boleh dipanggil dari Next.js runtime.

## migrate-v1-to-v2.ts

Migrasi data dari OMNI-STOCK V1.6 (`oevqixtlbxsvdjprjiol`) ke V2 (`rczzlvlprbttaqyxthkm`). Idempotent — bisa di-run berkali-kali, pakai `upsert` dengan conflict resolution.

### Pre-req

`.env.local` perlu berisi 4 variabel:

```
V1_SUPABASE_URL=https://oevqixtlbxsvdjprjiol.supabase.co
V1_SUPABASE_SERVICE_KEY=<sb_secret_*>      # generate di Supabase dashboard project V1.6
NEXT_PUBLIC_SUPABASE_URL=https://rczzlvlprbttaqyxthkm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_*>    # existing dari .env.local
```

### Cara generate `V1_SUPABASE_SERVICE_KEY`

1. Login ke https://supabase.com/dashboard sebagai akun btmk-star
2. Pilih project `supabase-omni-data` (`oevqixtlbxsvdjprjiol`)
3. Settings → API Keys → tab "Publishable and secret API keys"
4. Klik **"+ New secret key"** → nama: `migration-readonly-2026-05-12` → Create
5. Copy value (`sb_secret_*`) → paste ke `.env.local`

> Note: Karena V1.6 RLS DISABLED di semua table (sudah di-detect via Supabase advisor), publishable key sebenarnya cukup baca-tulis. Tapi service key lebih konvensional untuk script server-side.

### Penggunaan

```powershell
cd CODE/omni-stock-v2

# Preview (tidak menulis ke V2)
npx tsx scripts/migrate-v1-to-v2.ts --dry-run

# Apply real (idempotent — aman re-run kalau gagal di tengah)
npx tsx scripts/migrate-v1-to-v2.ts --apply

# Optional: dump snapshot lokal sebelum migrate (backup)
npx tsx scripts/migrate-v1-to-v2.ts --snapshot

# Step subset (kalau mau test 1 step saja)
npx tsx scripts/migrate-v1-to-v2.ts --apply --only suppliers,bahan
```

### Steps (urutan FK)

1. `outlets` (V1) → `pawoon_outlets` (V2) — pakai `pawoon_outlet_map` sebagai bridge
2. `master_vendor` (25) → `os_suppliers` — preserve ID, transform `vendor_platform` → `type`
3. `master_bahan` (272) → `os_bahan_baku` — preserve ID, transform field names
4. `vendor_bahan` (76) → backfill `os_bahan_baku.supplier_id` (pick `is_primary=true`)
5. `semi_finished` (9) → `os_raw_menu` — preserve ID
6. `master_menu` (172) → `os_master_menu` + auto-create `os_recipes` (1:1)
7. `mapping_resep` (189) → split `os_recipe_items` (parent=menu) + `os_raw_menu_items` (parent=semi_finished)
8. `purchase_orders` (228) → `os_purchase_orders` + `os_po_items` — group flat rows by (outlet,vendor,date)
9. `pawoon_outlet_map` → backfill `pawoon_outlets.pawoon_id`
10. `pawoon_product_map` (147) → backfill `os_master_menu.pawoon_product_id`

### Snapshot directory

[v1-snapshot/](v1-snapshot/) — backup JSON per table (output `--snapshot` mode). 3 file kecil sudah ada sebagai reference (outlets, master_vendor, pawoon_outlet_map) — fetched manual via Supabase MCP saat planning Phase 2.
