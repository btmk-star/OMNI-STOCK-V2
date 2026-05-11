// Verified shape per response actual https://open-api.pawoon.com (May 2026).
// Pawoon API butuh `outlet_id` mandatory di hampir semua endpoint.

export interface PawoonOutlet {
  id: string;
  name: string;
  add_ons?: string[];
  address?: string;
  phone?: string | null;
  city_id?: string;
  city_name?: string;
  province_id?: string;
  province_name?: string;
  latitude?: number;
  longitude?: number;
  taxes_and_services?: unknown[];
  is_open?: boolean;
  loyalty_outlet_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface PawoonCategory {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface PawoonProduct {
  id: string;
  name: string;
  sku?: string | null;
  price?: number;
  barcode?: string | null;
  description?: string | null;
  image?: string | null;
  tax?: string | number;
  stock_unit?: string;
  type?: string; // "single" | "variant" | dst
  has_alertstock?: boolean;
  is_sellable_by_stock?: boolean;
  stock_tracked?: boolean;
  sellable?: boolean;
  alert_stock_limit?: number;
  product_category_id?: string;
  has_modifier?: boolean;
  has_variant?: boolean;
  qty?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}

export interface PawoonTransactionItem {
  // Pawoon transaction items punya banyak fields — keep flexible
  product_id?: string;
  product_name?: string;
  qty?: number;
  price?: number;
  subtotal?: number;
  [key: string]: unknown;
}

export interface PawoonTransaction {
  id: string;
  receipt_code?: string;
  outlet_id: string;
  device_id?: string;
  cashier_id?: string;
  customer_id?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  sales_type_id?: string;
  sales_type_name?: string; // "Dine In", "Take Away", "Grab Food", dll
  device_timestamp: string; // tanggal transaksi
  total_payment?: number;
  total_tax?: number;
  total_discount?: number;
  total_service?: number;
  details?: PawoonTransactionItem[];
  payments?: unknown[];
  [key: string]: unknown;
}

export interface PawoonStockCardRow {
  outlet_id?: string;
  product_id?: string;
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
    count?: number;
    total?: number;
    page?: number;
    per_page?: number;
  };
}

export interface PawoonOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export type PawoonSession = 'breakfast' | 'lunch' | 'dinner' | 'late_night';
