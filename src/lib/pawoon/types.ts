// Shape Pawoon Open API response. Optional fields karena Pawoon docs tidak
// fully consistent dan beberapa field bisa hilang per-tenant.

export interface PawoonOutlet {
  id: string | number;
  name: string;
  address?: string;
  phone?: string;
  is_active?: boolean;
}

export interface PawoonCategory {
  id: string | number;
  name: string;
}

export interface PawoonProduct {
  id: string | number;
  name: string;
  category?: PawoonCategory | null;
  category_id?: string | number;
  category_name?: string;
  price?: number | string;
  sku?: string | null;
  barcode?: string | null;
  is_sold?: boolean;
  outlet_ids?: Array<string | number>;
  [key: string]: unknown;
}

export interface PawoonTransactionItem {
  product_id: string | number;
  product_name?: string;
  qty: number;
  price?: number;
  subtotal?: number;
  [key: string]: unknown;
}

export interface PawoonTransaction {
  id: string | number;
  outlet_id: string | number;
  transaction_date: string;
  total_amount?: number | string;
  payment_method?: string;
  customer_name?: string | null;
  channel?: string;
  items: PawoonTransactionItem[];
  [key: string]: unknown;
}

export interface PawoonStockCardRow {
  outlet_id: string | number;
  product_id: string | number;
  stok_awal?: number | string;
  masuk?: number | string;
  keluar?: number | string;
  penjualan?: number | string;
  transfer?: number | string;
  penyesuaian?: number | string;
  stok_akhir?: number | string;
  [key: string]: unknown;
}

export interface PawoonPaginatedResponse<T> {
  data: T[];
  meta?: {
    current_page?: number;
    last_page?: number;
    total_pages?: number;
    total?: number;
    per_page?: number;
  };
}

export interface PawoonOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export type PawoonSession = 'breakfast' | 'lunch' | 'dinner' | 'late_night';
