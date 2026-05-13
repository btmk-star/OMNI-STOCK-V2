import * as XLSX from 'xlsx';

export interface ParsedOpnameRow {
  source_row: number; // 1-indexed (row 1 = header, row 2 = first data)
  source_id: string | null;
  source_name: string | null;
  source_qty: number | null;
  source_outlet: string | null;
}

export interface ParseResult {
  rows: ParsedOpnameRow[];
  detected_columns: {
    id?: string;
    name?: string;
    qty?: string;
    outlet?: string;
  };
  warnings: string[];
  total_data_rows: number;
}

const PATTERNS = {
  id: /\b(id|sku|kode|code)\b/i,
  name: /\b(nama|name|produk|product|bahan|item|deskripsi)\b/i,
  qty: /(stok\s*akhir|qty|jumlah|quantity|stock|stok|total)/i,
  outlet: /\b(outlet|cabang|branch|store|toko)\b/i,
};

function normalizeHeader(h: string): string {
  return String(h ?? '').trim();
}

function detectColumns(headers: string[]): ParseResult['detected_columns'] {
  const out: ParseResult['detected_columns'] = {};
  // Priority: lebih spesifik dulu. "Stok Akhir" wins over generic "Stok".
  const qtyCandidates: Array<{ h: string; score: number }> = [];
  for (const h of headers) {
    const lower = h.toLowerCase();
    if (!out.id && PATTERNS.id.test(lower)) out.id = h;
    if (!out.name && PATTERNS.name.test(lower)) out.name = h;
    if (!out.outlet && PATTERNS.outlet.test(lower)) out.outlet = h;
    if (PATTERNS.qty.test(lower)) {
      // Score: "stok akhir" tertinggi
      let score = 1;
      if (/stok\s*akhir/i.test(lower)) score = 10;
      else if (/jumlah|quantity/i.test(lower)) score = 5;
      else if (/qty/i.test(lower)) score = 4;
      qtyCandidates.push({ h, score });
    }
  }
  qtyCandidates.sort((a, b) => b.score - a.score);
  if (qtyCandidates[0]) out.qty = qtyCandidates[0].h;
  return out;
}

function coerceNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    // Handle "1.234,56" (id-ID) atau "1,234.56" (en-US) atau plain
    const cleaned = v.replace(/\s/g, '');
    // Indonesia format: dot = thousand separator, comma = decimal
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
      const n = Number.parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
    // US format atau plain
    const n = Number.parseFloat(cleaned.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceString(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function parseOpnameWorkbook(buffer: ArrayBuffer): ParseResult {
  const warnings: string[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch (err) {
    return {
      rows: [],
      detected_columns: {},
      warnings: [`Gagal baca file: ${err instanceof Error ? err.message : 'unknown error'}`],
      total_data_rows: 0,
    };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      detected_columns: {},
      warnings: ['File tidak punya sheet'],
      total_data_rows: 0,
    };
  }
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  if (json.length === 0) {
    return {
      rows: [],
      detected_columns: {},
      warnings: ['File kosong (tidak ada baris data)'],
      total_data_rows: 0,
    };
  }

  const headers = Object.keys(json[0]).map(normalizeHeader);
  const detected = detectColumns(headers);

  if (!detected.qty) {
    warnings.push(
      'Tidak bisa deteksi kolom qty (stok akhir/jumlah/qty). Pastikan ada kolom dengan nama seperti "Stok Akhir", "Qty", atau "Jumlah".',
    );
  }
  if (!detected.id && !detected.name) {
    warnings.push(
      'Tidak bisa deteksi kolom ID atau Nama bahan. Pastikan ada kolom seperti "Nama Produk", "SKU", atau "Kode".',
    );
  }

  const rows: ParsedOpnameRow[] = [];
  for (let i = 0; i < json.length; i++) {
    const r = json[i];
    const row: ParsedOpnameRow = {
      source_row: i + 2, // +2: row 1 = header, +1 untuk 1-indexed
      source_id: detected.id ? coerceString(r[detected.id]) : null,
      source_name: detected.name ? coerceString(r[detected.name]) : null,
      source_qty: detected.qty ? coerceNumber(r[detected.qty]) : null,
      source_outlet: detected.outlet ? coerceString(r[detected.outlet]) : null,
    };
    rows.push(row);
  }

  return {
    rows,
    detected_columns: detected,
    warnings,
    total_data_rows: json.length,
  };
}
