/**
 * Pure helpers untuk reduce/aggregate dari pawoon_transactions di Server Component dashboard.
 */

export interface TrxLike {
  transaction_date: string;
  total_amount: number | string | null;
  session: 'breakfast' | 'lunch' | 'dinner' | 'late_night' | null;
  channel: string | null;
  pawoon_outlet_id: string;
  items?: unknown;
}

export interface TrxItem {
  product_id?: string;
  product_name?: string;
  qty?: number | string;
  subtotal?: number | string;
}

const JAKARTA_TZ = 'Asia/Jakarta';

export function jakartaDateKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: JAKARTA_TZ,
  }).format(d);
}

export function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function sumRevenue(trxs: TrxLike[]): number {
  return trxs.reduce((sum, t) => sum + asNumber(t.total_amount), 0);
}

export interface DayPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  trxCount: number;
}

export function groupByDay(trxs: TrxLike[]): DayPoint[] {
  const buckets = new Map<string, DayPoint>();
  for (const t of trxs) {
    const key = jakartaDateKey(t.transaction_date);
    const existing = buckets.get(key);
    if (existing) {
      existing.revenue += asNumber(t.total_amount);
      existing.trxCount += 1;
    } else {
      buckets.set(key, { date: key, revenue: asNumber(t.total_amount), trxCount: 1 });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface SessionPoint {
  session: 'breakfast' | 'lunch' | 'dinner' | 'late_night';
  label: string;
  trxCount: number;
  revenue: number;
}

const SESSION_ORDER: Array<SessionPoint['session']> = [
  'breakfast',
  'lunch',
  'dinner',
  'late_night',
];

const SESSION_LABEL: Record<SessionPoint['session'], string> = {
  breakfast: 'Breakfast (06-11)',
  lunch: 'Lunch (11-15)',
  dinner: 'Dinner (15-20)',
  late_night: 'Late Night (20-06)',
};

export function groupBySession(trxs: TrxLike[]): SessionPoint[] {
  const buckets = new Map<SessionPoint['session'], SessionPoint>();
  for (const s of SESSION_ORDER) {
    buckets.set(s, { session: s, label: SESSION_LABEL[s], trxCount: 0, revenue: 0 });
  }
  for (const t of trxs) {
    if (!t.session) continue;
    const point = buckets.get(t.session);
    if (!point) continue;
    point.trxCount += 1;
    point.revenue += asNumber(t.total_amount);
  }
  return Array.from(buckets.values());
}

export interface TopMenuPoint {
  productId: string;
  productName: string;
  qty: number;
  revenue: number;
}

export function topMenuByQty(trxs: TrxLike[], limit = 5): TopMenuPoint[] {
  const buckets = new Map<string, TopMenuPoint>();
  for (const t of trxs) {
    if (!Array.isArray(t.items)) continue;
    for (const raw of t.items as TrxItem[]) {
      const id = String(raw.product_id ?? '');
      if (!id) continue;
      const existing = buckets.get(id);
      const qty = asNumber(raw.qty);
      const subtotal = asNumber(raw.subtotal);
      if (existing) {
        existing.qty += qty;
        existing.revenue += subtotal;
      } else {
        buckets.set(id, {
          productId: id,
          productName: String(raw.product_name ?? id),
          qty,
          revenue: subtotal,
        });
      }
    }
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

/**
 * Dapatkan tanggal anchor (paling akhir) dari transactions untuk window 30/7 day.
 * Berguna kalau data historis (tidak ada transaksi baru hari ini).
 */
export function latestTrxDate(trxs: TrxLike[]): Date | null {
  if (trxs.length === 0) return null;
  let max = 0;
  for (const t of trxs) {
    const ts = new Date(t.transaction_date).getTime();
    if (ts > max) max = ts;
  }
  return max ? new Date(max) : null;
}

export function startOfDayJakarta(date: Date): Date {
  const key = jakartaDateKey(date);
  // 00:00:00 di Jakarta = -7 jam dari UTC
  return new Date(`${key}T00:00:00+07:00`);
}

export function daysAgoJakarta(date: Date, days: number): Date {
  return new Date(startOfDayJakarta(date).getTime() - days * 24 * 60 * 60 * 1000);
}
