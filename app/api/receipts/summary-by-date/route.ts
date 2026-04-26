import { NextRequest, NextResponse } from 'next/server';
import { getPortalContext } from '@/lib/portalContext';
import { fetchReceiptsSummaryByDate } from '@/lib/webapi';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPortalContext();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const date = searchParams.get('date');
    const timezoneOffsetMinutes = searchParams.has('timezoneOffsetMinutes')
      ? Number(searchParams.get('timezoneOffsetMinutes'))
      : undefined;

    if (!customerId) {
      return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Missing date' }, { status: 400 });
    }

    if (!ctx.isSuperAdmin && ctx.orgId !== customerId) {
      return NextResponse.json({ error: 'Forbidden for this organization' }, { status: 403 });
    }

    const summary = await fetchReceiptsSummaryByDate(
      customerId,
      date,
      Number.isFinite(timezoneOffsetMinutes) ? timezoneOffsetMinutes : undefined,
    );

    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load receipts summary by date' }, { status: 500 });
  }
}
