import { createClient } from '@/lib/supabase/server';
import { HppCalculator } from './hpp-calculator';

interface RecipeOption {
  id: string;
  name: string;
  menu_id: string | null;
  os_master_menu: { name: string; harga_jual: number | null } | null;
}

interface RecipeDetail {
  id: string;
  name: string;
  satuan_hasil: string | null;
  jumlah_hasil: number | null;
  total_cogs: number | null;
  cogs_per_unit: number | null;
  os_master_menu: { name: string; harga_jual: number | null } | null;
}

interface RecipeItem {
  id: string;
  bahan_id: string | null;
  raw_menu_id: string | null;
  qty: number;
  satuan: string | null;
  cost: number | null;
  sort_order: number | null;
  os_bahan_baku: { name: string; satuan_dapur: string | null; harga_per_porsi: number | null } | null;
  os_raw_menu: { name: string; satuan_hasil: string | null; cogs_per_unit: number | null } | null;
}

export default async function KalkulatorHppPage({
  searchParams,
}: {
  searchParams: Promise<{ recipe?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: recipes } = await supabase
    .from('os_recipes')
    .select('id,name,menu_id,os_master_menu(name,harga_jual)')
    .eq('is_active', true)
    .order('name');

  const recipeOptions = (recipes ?? []) as unknown as RecipeOption[];
  const selectedId = params.recipe ?? recipeOptions[0]?.id ?? '';

  let recipeDetail: RecipeDetail | null = null;
  let items: RecipeItem[] = [];

  if (selectedId) {
    const { data: detail } = await supabase
      .from('os_recipes')
      .select(
        'id,name,satuan_hasil,jumlah_hasil,total_cogs,cogs_per_unit,os_master_menu(name,harga_jual)',
      )
      .eq('id', selectedId)
      .single<RecipeDetail>();

    recipeDetail = detail;

    const { data: itemRows } = await supabase
      .from('os_recipe_items')
      .select(
        'id,bahan_id,raw_menu_id,qty,satuan,cost,sort_order,os_bahan_baku(name,satuan_dapur,harga_per_porsi),os_raw_menu(name,satuan_hasil,cogs_per_unit)',
      )
      .eq('recipe_id', selectedId)
      .order('sort_order');

    items = (itemRows ?? []) as unknown as RecipeItem[];
  }

  return (
    <HppCalculator
      recipes={recipeOptions}
      selectedId={selectedId}
      detail={recipeDetail}
      items={items}
    />
  );
}
