import { NextResponse } from 'next/server';
import { availableProviders, sendWhatsApp } from '@/lib/wa';
import { fonnteDeviceStatus } from '@/lib/wa/fonnte';

export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const providers = availableProviders();
  const checks: Record<string, unknown> = {};
  if (providers.includes('fonnte')) {
    checks.fonnte = await fonnteDeviceStatus();
  }
  if (providers.includes('kirimchat')) {
    checks.kirimchat = { configured: true };
  }

  return NextResponse.json({
    ok: true,
    available: providers,
    checks,
  });
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await req.json()) as {
    provider?: 'fonnte' | 'kirimchat';
    to?: string;
    message?: string;
  };
  if (!body.provider || !body.to || !body.message) {
    return NextResponse.json(
      { ok: false, error: 'provider/to/message wajib diisi' },
      { status: 400 },
    );
  }
  const result = await sendWhatsApp(body.provider, {
    to: body.to,
    message: body.message,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
