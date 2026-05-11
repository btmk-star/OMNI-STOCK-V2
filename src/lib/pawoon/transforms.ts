import type {
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

function asArrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

const JAKARTA_TZ = 'Asia/Jakarta';

export function detectSession(date: Date | string): PawoonSession {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Convert to Jakarta hour using Intl (avoids dependency on host TZ).
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

export function pawoonProductToRow(p: PawoonProduct): PawoonProductRow {
  const categoryId = p.category?.id ?? p.category_id;
  const categoryName = p.category?.name ?? p.category_name ?? null;
  return {
    pawoon_id: asString(p.id),
    name: asString(p.name),
    category_name: categoryName ? asString(categoryName) : null,
    pawoon_category_id: categoryId ? asString(categoryId) : null,
    price: asNumber(p.price),
    sku: asOptionalString(p.sku),
    barcode: asOptionalString(p.barcode),
    is_sold: p.is_sold !== false,
    outlet_ids: asArrayOfStrings(p.outlet_ids),
    raw_data: p,
    synced_at: new Date().toISOString(),
  };
}

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
  periodDate: string,
): PawoonStockCardRowMapped {
  return {
    pawoon_outlet_id: asString(row.outlet_id),
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
    transaction_date: t.transaction_date,
    total_amount: asNumber(t.total_amount),
    payment_method: asOptionalString(t.payment_method),
    items: t.items ?? [],
    customer_name: asOptionalString(t.customer_name),
    channel: asOptionalString(t.channel),
    session: detectSession(t.transaction_date),
    raw_data: t,
    synced_at: new Date().toISOString(),
  };
}

export function todayInJakarta(): string {
  // Returns YYYY-MM-DD in Asia/Jakarta timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: JAKARTA_TZ,
  });
  return formatter.format(new Date());
}
