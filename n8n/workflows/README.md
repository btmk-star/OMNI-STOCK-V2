# n8n Workflows — OMNI-STOCK V2.0

Workflows ini siap di-import ke n8n self-hosted. File `.json` ikut Quality Rules §C (naming, error handling, retry, logging).

## Phase 1 deliverables

| File | Trigger | Purpose |
|------|---------|---------|
| [WF-01_pawoon_product_sync.json](WF-01_pawoon_product_sync.json) | Cron every 15 min | Sync produk + kategori dari Pawoon → `pawoon_products` |
| [WF-03_pawoon_stock_card_sync.json](WF-03_pawoon_stock_card_sync.json) | Cron every 30 min | Sync kartu stok hari ini per outlet → `pawoon_stock_cards` |

## Pre-requisites di n8n

1. Aktif workflow Schedule Trigger sudah enable di environment.
2. Buat **2 credentials** (Quality Rules §C3):
   - **Pawoon API - Production** — type `OAuth2 API` (Marketplace App ID + Secret).
   - **Supabase - Service Role** — type `Supabase API` dengan service-role key.
3. Set environment variable di n8n: `PAWOON_API_BASE_URL=https://open-api.pawoon.com`.
4. Database `pawoon_products`, `pawoon_stock_cards`, `pawoon_sync_log` sudah ter-apply (lihat `supabase/migrations/`).

## Cara import

1. Di n8n UI → **Workflows** → tombol **Import from File** → pilih `.json`.
2. Setelah import, klik tiap node yang punya `credentials` → ubah ke credential lokal kamu (yang baru dibuat). String `REPLACE_*_CRED_ID` adalah placeholder agar import tidak gagal.
3. Test via **Execute Workflow** (tidak perlu activate dulu).
4. Cek `pawoon_products` / `pawoon_stock_cards` di Supabase terisi.
5. Cek `pawoon_sync_log` untuk record `status = success`.
6. Activate workflow setelah test pass.

## Error handling

Belum dipasang error workflow di Phase 1 — tambahkan **Error Trigger** workflow terpisah (Quality Rules §C4) sebelum production:

```
Error Trigger → FORMAT message → SEND to admin WA (Fonnte) → LOG to n8n_error_logs
```

## Tag organization

Sesuai Quality Rules §C1 — assign minimal 1 tag per workflow:

- `pawoon-sync` (semua sync workflow)
- `scheduled` (WF-01, WF-03)

## Roadmap workflow lanjutan (Phase 2-5)

| ID | Trigger | Phase |
|----|---------|-------|
| WF-02 | Pawoon webhook + cron 5 min fallback | Phase 2 — transaction sync + session detection |
| WF-04 | Supabase DB trigger | Phase 5 — stock alert → WA |
| WF-05 | Cron daily 02:00 | Phase 4 — Claude AI prediction |
| WF-06 | Cron daily 06:00 | Phase 5 — daily report → WA |
| WF-07 | Supabase webhook (PO status=received) | Phase 5 — push stock to Pawoon |
| WF-08 | Cron daily 23:00 | Phase 5 — reconciliation |
| WF-09 | Supabase webhook (delivery accepted) | Phase 5 — delivery stock push |
| WF-10 | Supabase webhook (PO status=approved/ordered) | Phase 5 — PO → WA template |
