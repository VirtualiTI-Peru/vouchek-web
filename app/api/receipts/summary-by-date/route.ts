import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
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
      return NextResponse.json({ error: ApiErrors.MISSING_CUSTOMER_ID }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: ApiErrors.MISSING_DATE }, { status: 400 });
    }

    if (!ctx.isSuperAdmin && ctx.orgId !== customerId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    // Transportista is scoped inside fetchReceiptsSummaryByDate (filter + per-user cache).
    const summary = await fetchReceiptsSummaryByDate(
      customerId,
      date,
      Number.isFinite(timezoneOffsetMinutes) ? timezoneOffsetMinutes : undefined,
    );

    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || ApiErrors.FETCH_RECEIPTS_SUMMARY_BY_DATE }, { status: 500 });
  }
}
