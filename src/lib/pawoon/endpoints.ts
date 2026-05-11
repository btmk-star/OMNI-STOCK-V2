export const PAWOON_BASE_URL =
  process.env.PAWOON_API_BASE_URL ?? 'https://open-api.pawoon.com';

export const PAWOON_PATHS = {
  oauthToken: '/oauth/token',
  products: '/products',
  productCategories: '/products/categories',
  transactions: '/transactions',
  inventoryStockCard: '/inventory/stockcard',
  inventoryUpdate: '/inventory',
  outlets: '/outlets',
} as const;

export const PAWOON_DEFAULT_PER_PAGE = 100;
export const PAWOON_REQUEST_TIMEOUT_MS = 30_000;
export const PAWOON_RETRY_DELAYS_MS = [1000, 2000, 4000];
