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
  metadata: {
    outlet?: string;
    tanggal?: string;
    [key: string]: string | undefined;
  };
  warnings: string[];
  total_data_rows: number;
  header_row_index: number; // 1-indexed (row di Excel)
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

/**
 * Cari row index yang paling kemungkinan adalah header data table.
 * Strategi: scan 20 baris pertama, beri skor berdasarkan jumlah pattern kolom yang ditemukan.
 * Pawoon Kartu Stok export punya 7 baris metadata (Outlet/Tanggal/Status/dst) dulu,
 * baru di row 8 muncul header asli (Produk | Kategori | Stok Awal | dst).
 */
function findHeaderRow(arrayJson: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = 0;
  const limit = Math.min(20, arrayJson.length);
  for (let i = 0; i < limit; i++) {
    const row = arrayJson[i];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? '').toLowerCase().trim()).filter(Boolean);
    if (cells.length < 2) continue; // header pasti punya >= 2 kolom

    let score = 0;
    if (cells.some((c) => /\b(produk|nama|bahan|item|deskripsi)\b/.test(c))) score += 2;
    if (cells.some((c) => /stok\s*akhir/.test(c))) score += 3;
    if (cells.some((c) => /\b(kategori|category)\b/.test(c))) score += 1;
    if (cells.some((c) => /\b(satuan|unit)\b/.test(c))) score += 1;
    if (cells.some((c) => /stok\s*awal|masuk|keluar|penjualan/.test(c))) score += 1;
    if (cells.some((c) => /\b(qty|jumlah|quantity)\b/.test(c))) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= 2 ? bestIdx : 0;
}

/**
 * Extract metadata dari rows di atas header — biasanya format "Label\tValue" per row.
 * Contoh: ["Outlet", "Back To Mie Kitchen"] → metadata.outlet = "Back To Mie Kitchen"
 */
function extractMetadata(rowsAboveHeader: unknown[][]): ParseResult['metadata'] {
  const meta: ParseResult['metadata'] = {};
  for (const row of rowsAboveHeader) {
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => coerceString(c));
    // Cari pasangan label-value: cell pertama yang non-null = label, cell kedua = value
    const nonNull = cells
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c != null);
    if (nonNull.length < 2) continue;
    const label = nonNull[0].c!.toLowerCase();
    const value = nonNull[1].c!;
    if (/outlet|cabang|store|toko/.test(label)) meta.outlet = value;
    else if (/tanggal|date/.test(label)) meta.tanggal = value;
    else if (/status\s*produk/.test(label)) meta.status_produk = value;
    else if (/status\s*stock/.test(label)) meta.status_stock = value;
  }
  return meta;
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
      metadata: {},
      warnings: [`Gagal baca file: ${err instanceof Error ? err.message : 'unknown error'}`],
      total_data_rows: 0,
      header_row_index: 0,
    };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      detected_columns: {},
      metadata: {},
      warnings: ['File tidak punya sheet'],
      total_data_rows: 0,
      header_row_index: 0,
    };
  }
  const sheet = wb.Sheets[sheetName];

  // Read sebagai 2D array dengan blank rows PRESERVED supaya index match dengan Excel rows.
  // Penting: kalau blankrows: false (default lain), index ter-shift dan rusak header detection.
  const arrayJson = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: true,
  });

  if (arrayJson.length === 0) {
    return {
      rows: [],
      detected_columns: {},
      metadata: {},
      warnings: ['File kosong (tidak ada baris)'],
      total_data_rows: 0,
      header_row_index: 0,
    };
  }

  const headerRowIdx = findHeaderRow(arrayJson);
  const metadata = extractMetadata(arrayJson.slice(0, headerRowIdx));

  // Build header dari row yang ter-detect
  const headerRow = arrayJson[headerRowIdx];
  if (!Array.isArray(headerRow)) {
    return {
      rows: [],
      detected_columns: {},
      metadata,
      warnings: ['Tidak bisa baca baris header'],
      total_data_rows: 0,
      header_row_index: headerRowIdx + 1,
    };
  }
  const headers = headerRow.map((h, i) => {
    const s = normalizeHeader(String(h ?? ''));
    return s || `__col_${i}`;
  });
  const detected = detectColumns(headers);

  if (!detected.qty) {
    warnings.push(
      `Tidak bisa deteksi kolom qty (stok akhir/jumlah/qty). Header yang terbaca: ${headers.filter((h) => !h.startsWith('__col_')).slice(0, 10).join(', ')}`,
    );
  }
  if (!detected.id && !detected.name) {
    warnings.push(
      `Tidak bisa deteksi kolom ID atau Nama. Header yang terbaca: ${headers.filter((h) => !h.startsWith('__col_')).slice(0, 10).join(', ')}`,
    );
  }
  if (headerRowIdx > 0) {
    warnings.push(
      `Header data terdeteksi di baris Excel ${headerRowIdx + 1} (${headerRowIdx} baris metadata di-skip).`,
    );
  }

  // Index map: kolom name → kolom index
  const colIdx = {
    id: detected.id ? headers.indexOf(detected.id) : -1,
    name: detected.name ? headers.indexOf(detected.name) : -1,
    qty: detected.qty ? headers.indexOf(detected.qty) : -1,
    outlet: detected.outlet ? headers.indexOf(detected.outlet) : -1,
  };

  const rows: ParsedOpnameRow[] = [];
  let dataRowsCount = 0;
  for (let i = headerRowIdx + 1; i < arrayJson.length; i++) {
    const r = arrayJson[i];
    if (!Array.isArray(r)) continue;
    // Skip baris yang semua cell-nya null/empty
    const hasContent = r.some((c) => c != null && String(c).trim() !== '');
    if (!hasContent) continue;
    dataRowsCount += 1;

    rows.push({
      source_row: i + 1, // 1-indexed Excel row
      source_id: colIdx.id >= 0 ? coerceString(r[colIdx.id]) : null,
      source_name: colIdx.name >= 0 ? coerceString(r[colIdx.name]) : null,
      source_qty: colIdx.qty >= 0 ? coerceNumber(r[colIdx.qty]) : null,
      source_outlet:
        colIdx.outlet >= 0 ? coerceString(r[colIdx.outlet]) : metadata.outlet ?? null,
    });
  }

  return {
    rows,
    detected_columns: detected,
    metadata,
    warnings,
    total_data_rows: dataRowsCount,
    header_row_index: headerRowIdx + 1,
  };
}
