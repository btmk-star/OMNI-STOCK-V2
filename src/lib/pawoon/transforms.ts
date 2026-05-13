import type {
  PawoonOutlet,
  PawoonProduct,
  PawoonSession,
  PawoonStockCardRow,
  PawoonTransaction,
} from './types';

function asString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function asOptionalString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

const JAKARTA_TZ = 'Asia/Jakarta';

export function detectSession(date: Date | string): PawoonSession {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hour = Number.parseInt(
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone: JAKARTA_TZ,
    }).format(d),
    10,
  );

  if (hour >= 6 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 20) return 'dinner';
  return 'late_night';
}

// =====================================================
// Outlet
// =====================================================
export interface PawoonOutletRow {
  pawoon_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  raw_data: PawoonOutlet;
  synced_at: string;
}

export function pawoonOutletToRow(o: PawoonOutlet): PawoonOutletRow {
  return {
    pawoon_id: asString(o.id),
    name: asString(o.name),
    address: asOptionalString(o.address),
    phone: asOptionalString(o.phone),
    is_active: o.deleted_at === null || o.deleted_at === undefined,
    raw_data: o,
    synced_at: new Date().toISOString(),
  };
}

// =====================================================
// Product
// =====================================================
export interface PawoonProductRow {
  pawoon_id: string;
  name: string;
  category_name: string | null;
  pawoon_category_id: string | null;
  price: number;
  sku: string | null;
  barcode: string | null;
  is_sold: boolean;
  outlet_ids: string[];
  raw_data: PawoonProduct;
  synced_at: string;
}

export function pawoonProductToRow(
  p: PawoonProduct,
  outletId: string,
  categoryNameById?: Map<string, string>,
): PawoonProductRow {
  const categoryId = p.product_category_id ? asString(p.product_category_id) : null;
  const categoryName = categoryId && categoryNameById ? categoryNameById.get(categoryId) ?? null : null;
  return {
    pawoon_id: asString(p.id),
    name: asString(p.name),
    category_name: categoryName,
    pawoon_category_id: categoryId,
    price: asNumber(p.price),
    sku: asOptionalString(p.sku),
    barcode: asOptionalString(p.barcode),
    // Pawoon pakai `sellable`. Default true kalau tidak ada field-nya.
    is_sold: p.sellable !== false,
    // Products per-outlet di Pawoon — outlet_ids berisi outlet ID tempat produk ini di-fetch.
    // Kalau produk yang sama muncul di beberapa outlet, akan ada multiple rows berbeda — onConflict
    // (pawoon_id) akan replace. Untuk merge outlet_ids dari multiple outlet, perlu logic
    // di sync endpoint (gabung array sebelum upsert).
    outlet_ids: [outletId],
    raw_data: p,
    synced_at: new Date().toISOString(),
  };
}

// =====================================================
// Stock Card
// =====================================================
export interface PawoonStockCardRowMapped {
  pawoon_outlet_id: string;
  pawoon_product_id: string;
  period_date: string;
  stok_awal: number;
  masuk: number;
  keluar: number;
  penjualan: number;
  transfer: number;
  penyesuaian: number;
  stok_akhir: number;
  raw_data: PawoonStockCardRow;
  synced_at: string;
}

export function pawoonStockCardToRow(
  row: PawoonStockCardRow,
  outletId: string,
  periodDate: string,
): PawoonStockCardRowMapped {
  return {
    // Pawoon stock card response sometimes includes outlet_id, fallback ke param.
    pawoon_outlet_id: row.outlet_id ? asString(row.outlet_id) : outletId,
    pawoon_product_id: asString(row.product_id),
    period_date: periodDate,
    stok_awal: asNumber(row.stok_awal),
    masuk: asNumber(row.masuk),
    keluar: asNumber(row.keluar),
    penjualan: asNumber(row.penjualan),
    transfer: asNumber(row.transfer),
    penyesuaian: asNumber(row.penyesuaian),
    stok_akhir: asNumber(row.stok_akhir),
    raw_data: row,
    synced_at: new Date().toISOString(),
  };
}

// =====================================================
// Transaction
// =====================================================
export interface PawoonTransactionRow {
  pawoon_id: string;
  pawoon_outlet_id: string;
  transaction_date: string;
  total_amount: number;
  payment_method: string | null;
  items: unknown;
  customer_name: string | null;
  channel: string | null;
  session: PawoonSession;
  raw_data: PawoonTransaction;
  synced_at: string;
}

export function pawoonTransactionToRow(t: PawoonTransaction): PawoonTransactionRow {
  return {
    pawoon_id: asString(t.id),
    pawoon_outlet_id: asString(t.outlet_id),
    transaction_date: t.device_timestamp,
    total_amount: asNumber(t.total_payment),
    payment_method: null, // Pawoon stores di sub-array `payments`, ambil kalau perlu
    items: t.details ?? [],
    customer_name: asOptionalString(t.customer_name),
    channel: asOptionalString(t.sales_type_name),
    session: detectSession(t.device_timestamp),
    raw_data: t,
    synced_at: new Date().toISOString(),
  };
}

// =====================================================
// Utilities
// =====================================================
export function todayInJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: JAKARTA_TZ,
  }).format(new Date());
}

/**
 * Hari Jakarta dikurangi `daysAgo`. Default 1 = kemarin.
 * Pakai timestamp 12:00 UTC dari hari ini Jakarta sebagai anchor, lalu rollback hari
 * untuk hindari boundary issue jam 00:00-07:00 WIB.
 */
export function daysAgoInJakarta(daysAgo = 1): string {
  const todayKey = todayInJakarta(); // YYYY-MM-DD di Jakarta
  // Anchor di tengah hari Jakarta (05:00 UTC = 12:00 WIB) supaya rollback selalu konsisten.
  const anchor = new Date(`${todayKey}T05:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: JAKARTA_TZ,
  }).format(anchor);
}

export function yesterdayInJakarta(): string {
  return daysAgoInJakarta(1);
}

/**
 * Compute total pages dari Pawoon meta `{count, total, per_page}`.
 * Pawoon tidak return `last_page` atau `total_pages`, jadi compute manual.
 */
export function pawoonTotalPages(meta?: { total?: number; per_page?: number }): number {
  if (!meta?.total || !meta?.per_page) return 1;
  return Math.max(1, Math.ceil(meta.total / meta.per_page));
}
