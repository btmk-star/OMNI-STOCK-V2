/**
 * Pure helpers untuk compute live stock bahan baku dari:
 * - Stock opname terakhir (baseline)
 * - PO received sejak baseline
 * - Konsumsi dari penjualan menu (pawoon_transactions × os_recipes → bahan)
 * - Adjustment (damage, transfer, reconciliation, manual)
 */

export interface BahanInput {
  id: string;
  name: string;
  outlet_id: string | null;
  kategori: string | null;
  satuan_dapur: string | null;
  min_stok: number | null;
  is_active: boolean;
}

export interface RecipeItemInput {
  recipe_id: string;
  bahan_id: string | null;
  raw_menu_id: string | null;
  qty: number;
}

export interface RawMenuItemInput {
  raw_menu_id: string;
  bahan_id: string;
  qty: number;
}

export interface RecipeMetaInput {
  recipe_id: string;
  jumlah_hasil: number;
}

export interface RawMenuMetaInput {
  raw_menu_id: string;
  jumlah_hasil: number;
}

export interface MenuMapInput {
  pawoon_product_id: string;
  recipe_id: string | null;
}

export interface TransactionItemInput {
  product_id: string; // pawoon_product_id
  qty: number;
}

export interface TransactionInput {
  transaction_date: string;
  pawoon_outlet_id: string;
  items: TransactionItemInput[];
}

export interface POItemInput {
  bahan_id: string;
  qty_received: number;
  po_received_at: string; // datetime
}

export interface AdjustmentInput {
  bahan_id: string;
  outlet_id: string | null;
  adjustment_type: 'opname' | 'reconciliation' | 'manual' | 'damage' | 'transfer';
  qty_after: number | null;
  qty_diff: number | null;
  adjusted_at: string;
}

export interface ComputedStock {
  bahan_id: string;
  outlet_id: string | null;
  baseline_qty: number | null;
  baseline_date: string | null;
  received_since: number;
  consumed_since: number;
  adjustments_since: number;
  current_stock: number | null;
  status: 'safe' | 'warning' | 'critical' | 'no_baseline';
}

interface BomMap {
  // recipe_id → recipe_items[]
  recipeItems: Map<string, RecipeItemInput[]>;
  // raw_menu_id → raw_menu_items[]
  rawMenuItems: Map<string, RawMenuItemInput[]>;
  // pawoon_product_id → recipe_id
  pawoonToRecipe: Map<string, string>;
  // recipe_id → jumlah_hasil (untuk normalize)
  recipeYield: Map<string, number>;
  // raw_menu_id → jumlah_hasil
  rawMenuYield: Map<string, number>;
}

export function buildBomMap(input: {
  recipes: RecipeMetaInput[];
  recipeItems: RecipeItemInput[];
  rawMenus: RawMenuMetaInput[];
  rawMenuItems: RawMenuItemInput[];
  menus: MenuMapInput[];
}): BomMap {
  const recipeItems = new Map<string, RecipeItemInput[]>();
  for (const it of input.recipeItems) {
    const list = recipeItems.get(it.recipe_id) ?? [];
    list.push(it);
    recipeItems.set(it.recipe_id, list);
  }
  const rawMenuItems = new Map<string, RawMenuItemInput[]>();
  for (const it of input.rawMenuItems) {
    const list = rawMenuItems.get(it.raw_menu_id) ?? [];
    list.push(it);
    rawMenuItems.set(it.raw_menu_id, list);
  }
  const pawoonToRecipe = new Map<string, string>();
  for (const m of input.menus) {
    if (m.recipe_id) pawoonToRecipe.set(m.pawoon_product_id, m.recipe_id);
  }
  const recipeYield = new Map<string, number>();
  for (const r of input.recipes) {
    recipeYield.set(r.recipe_id, r.jumlah_hasil || 1);
  }
  const rawMenuYield = new Map<string, number>();
  for (const r of input.rawMenus) {
    rawMenuYield.set(r.raw_menu_id, r.jumlah_hasil || 1);
  }
  return { recipeItems, rawMenuItems, pawoonToRecipe, recipeYield, rawMenuYield };
}

/**
 * Untuk satu transaction item (menu jadi), explode jadi konsumsi bahan baku.
 * Output: Map<bahan_id, qty>.
 */
function explodeItemToBahan(
  pawoonProductId: string,
  itemQty: number,
  bom: BomMap,
  out: Map<string, number>,
): void {
  const recipeId = bom.pawoonToRecipe.get(pawoonProductId);
  if (!recipeId) return; // menu manual tanpa recipe — skip
  const items = bom.recipeItems.get(recipeId);
  if (!items) return;
  const recipeYield = bom.recipeYield.get(recipeId) ?? 1;
  // Per 1 portion menu = (recipe_item.qty / recipe.jumlah_hasil) bahan
  for (const ri of items) {
    if (ri.bahan_id) {
      const qty = (ri.qty / recipeYield) * itemQty;
      out.set(ri.bahan_id, (out.get(ri.bahan_id) ?? 0) + qty);
    } else if (ri.raw_menu_id) {
      const rawItems = bom.rawMenuItems.get(ri.raw_menu_id);
      if (!rawItems) continue;
      const rawYield = bom.rawMenuYield.get(ri.raw_menu_id) ?? 1;
      // Per 1 portion menu butuh (ri.qty / recipeYield) unit SFG.
      // 1 unit SFG = (rmi.qty / rawYield) bahan.
      const sfgPerMenu = ri.qty / recipeYield;
      for (const rmi of rawItems) {
        const qty = (rmi.qty / rawYield) * sfgPerMenu * itemQty;
        out.set(rmi.bahan_id, (out.get(rmi.bahan_id) ?? 0) + qty);
      }
    }
  }
}

/**
 * Compute consumption per bahan dari transaksi (sejak baseline date).
 * Returns Map<bahan_id, total_qty_consumed>.
 * Tidak filter per outlet di sini — caller filter sebelumnya.
 */
export function computeConsumption(
  transactions: TransactionInput[],
  bom: BomMap,
): Map<string, number> {
  const consumed = new Map<string, number>();
  for (const trx of transactions) {
    for (const item of trx.items) {
      explodeItemToBahan(item.product_id, item.qty, bom, consumed);
    }
  }
  return consumed;
}

/**
 * Final compute per bahan.
 * adjustments harus include type='opname' sebagai baseline + adjustment lain sebagai delta.
 */
export function computeStockPerBahan(
  bahan: BahanInput,
  opts: {
    consumption: number;
    received: number;
    adjustmentsSinceBaseline: AdjustmentInput[];
    lastOpname: AdjustmentInput | null;
  },
): ComputedStock {
  const baselineQty = opts.lastOpname?.qty_after ?? null;
  const baselineDate = opts.lastOpname?.adjusted_at ?? null;

  const adjSum = opts.adjustmentsSinceBaseline
    .filter((a) => a.adjustment_type !== 'opname')
    .reduce((s, a) => s + (a.qty_diff ?? 0), 0);

  let currentStock: number | null = null;
  if (baselineQty != null) {
    currentStock = baselineQty + opts.received - opts.consumption + adjSum;
    // Round to 3 decimal places
    currentStock = Math.round(currentStock * 1000) / 1000;
  }

  let status: ComputedStock['status'];
  if (currentStock == null) {
    status = 'no_baseline';
  } else if (bahan.min_stok == null) {
    status = 'safe';
  } else if (currentStock < bahan.min_stok) {
    status = 'critical';
  } else if (currentStock < bahan.min_stok * 2) {
    status = 'warning';
  } else {
    status = 'safe';
  }

  return {
    bahan_id: bahan.id,
    outlet_id: bahan.outlet_id,
    baseline_qty: baselineQty,
    baseline_date: baselineDate,
    received_since: Math.round(opts.received * 1000) / 1000,
    consumed_since: Math.round(opts.consumption * 1000) / 1000,
    adjustments_since: Math.round(adjSum * 1000) / 1000,
    current_stock: currentStock,
    status,
  };
}
