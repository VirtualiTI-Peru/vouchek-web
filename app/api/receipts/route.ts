import { NextRequest, NextResponse } from 'next/server';
import { getPortalContext } from '@/lib/portalContext';
import { fetchReceiptsPage } from '@/lib/webapi';

const DEFAULT_PAGE_SIZE = Number(process.env.RECEIPTS_PAGE_SIZE) || 50;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPortalContext();
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }

    if (!ctx.isSuperAdmin && ctx.orgId !== orgId) {
      return NextResponse.json({ error: 'Forbidden for this organization' }, { status: 403 });
    }

    const page = Math.max(Number(searchParams.get('page') ?? '1') || 1, 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const forceRefresh = searchParams.get('refresh') === '1';
    const receiptsPage = await fetchReceiptsPage(orgId, {
      skip: (page - 1) * pageSize,
      take: pageSize,
      forceRefresh,
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
