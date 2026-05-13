'use server';

import { availableProviders, type WaProvider } from '@/lib/wa';

export async function getAvailableProviders(): Promise<WaProvider[]> {
  return availableProviders();
}
