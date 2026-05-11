export const SITE_CONFIG = {
  name: 'OMNI-STOCK',
  fullName: 'OMNI-STOCK V2.0',
  description:
    'Pawoon-First inventory & operations platform untuk EGG Group F&B network',
  version: '2.0.0',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
} as const;
