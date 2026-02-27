import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { getPortalContext } from '@/lib/portalContext';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPortalContext();
    return NextResponse.json(ctx);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || ApiErrors.UNKNOWN }, { status: 500 });
  }
}
