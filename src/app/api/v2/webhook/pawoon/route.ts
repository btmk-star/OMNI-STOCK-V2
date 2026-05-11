import { NextRequest } from 'next/server';

export async function POST(_request: NextRequest) {
  return Response.json(
    { success: false, error: 'Pawoon webhook handler not implemented yet — Phase 2' },
    { status: 501 },
  );
}
