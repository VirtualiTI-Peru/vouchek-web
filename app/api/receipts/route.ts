import { NextRequest, NextResponse } from 'next/server';
import { fetchReceipts } from '@/lib/webapi';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }
    const receipts = await fetchReceipts(orgId);
    return NextResponse.json(receipts);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch receipts' }, { status: 500 });
  }
}
