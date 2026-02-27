import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { getPortalContext } from '@/lib/portalContext';
import { fetchReceiptsSummary } from '@/lib/webapi';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPortalContext();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    if (!customerId) {
      return NextResponse.json({ error: ApiErrors.MISSING_CUSTOMER_ID }, { status: 400 });
    }

    if (!ctx.isSuperAdmin && ctx.orgId !== customerId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const forceRefresh = searchParams.get('refresh') === '1';
    const summary = await fetchReceiptsSummary(customerId, { forceRefresh });
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || ApiErrors.FETCH_RECEIPTS_SUMMARY }, { status: 500 });
  }
}
