import { NextRequest, NextResponse } from 'next/server';
import { getPortalContext } from '@/lib/portalContext';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPortalContext();
    return NextResponse.json(ctx);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
