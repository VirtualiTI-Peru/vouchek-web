import { NextRequest, NextResponse } from 'next/server';
import { getPortalContext } from '@/lib/portalContext';
import { fetchReceiptsPage } from '@/lib/webapi';

const DEFAULT_PAGE_SIZE = Number(process.env.RECEIPTS_PAGE_SIZE) || 50;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPortalContext();
    const { searchParams } = new URL(req.url);

    const customerId = searchParams.get('customerId');
    if (!customerId) {
      return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
    }

    if (!ctx.isSuperAdmin && ctx.orgId !== customerId) {
      return NextResponse.json({ error: 'Forbidden for this organization' }, { status: 403 });
    }

    const page = Math.max(Number(searchParams.get('page') ?? '1') || 1, 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const forceRefresh = searchParams.get('refresh') === '1';
    const date = searchParams.get('date') ?? undefined;
    const transactionSource = searchParams.get('transactionSource') ?? undefined;
    const userId = searchParams.get('userId') ?? undefined;
    const timezoneOffsetMinutes = searchParams.has('timezoneOffsetMinutes')
      ? Number(searchParams.get('timezoneOffsetMinutes'))
      : undefined;
    const receiptsPage = await fetchReceiptsPage(customerId, {
      skip: (page - 1) * pageSize,
      take: pageSize,
      forceRefresh,
      date,
      transactionSource,
      userId,
      timezoneOffsetMinutes: Number.isFinite(timezoneOffsetMinutes) ? timezoneOffsetMinutes : undefined,
    });

    return NextResponse.json({
      ...receiptsPage,
      page,
      pageSize,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch receipts' }, { status: 500 });
  }
}
