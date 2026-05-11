import { NextRequest } from 'next/server';

export function verifyCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  if (!header) return false;
  return header === `Bearer ${secret}`;
}

export function unauthorizedResponse() {
  return Response.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 },
  );
}

export interface SyncLogEntry {
  workflow: string;
  table_name: string;
  records_synced: number;
  duration_ms: number;
  status: 'success' | 'partial' | 'failed';
  error?: string | null;
}

export function startTimer() {
  const start = Date.now();
  return () => Date.now() - start;
}
