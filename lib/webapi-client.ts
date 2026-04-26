import type { Receipt, ReceiptsSummaryByDate } from './api-types';

// Fetch all receipts for a customer using the public API route (client/browser safe)
export async function fetchReceipts(customerId: string, options: { forceRefresh?: boolean; date?: string; timezoneOffsetMinutes?: number; transactionSource?: string; userId?: string } = {}): Promise<Receipt[]> {
  let allReceipts: Receipt[] = [];
  let page = 1;
  const pageSize = 200;
  let hasMore = true;
  while (hasMore) {
    const params = new URLSearchParams({
      customerId,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (options.forceRefresh) params.set('refresh', '1');
    if (options.date) params.set('date', options.date);
    if (options.transactionSource) params.set('transactionSource', options.transactionSource);
    if (options.userId) params.set('userId', options.userId);
    if (typeof options.timezoneOffsetMinutes === 'number') {
      params.set('timezoneOffsetMinutes', String(options.timezoneOffsetMinutes));
    }
    const res = await fetch(`/api/receipts?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch receipts');
    const data = await res.json();
    if (Array.isArray(data.receipts)) {
      allReceipts = allReceipts.concat(data.receipts);
      hasMore = !!data.hasMore;
      page++;
    } else {
      hasMore = false;
    }
  }
  return allReceipts;
}

export async function fetchReceiptsSummaryByDate(
  customerId: string,
  date: string,
  options: { timezoneOffsetMinutes?: number } = {},
): Promise<ReceiptsSummaryByDate> {
  const params = new URLSearchParams({
    customerId,
    date,
  });

  if (typeof options.timezoneOffsetMinutes === 'number') {
    params.set('timezoneOffsetMinutes', String(options.timezoneOffsetMinutes));
  }

  const res = await fetch(`/api/receipts/summary-by-date?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch receipts summary by date');
  }

  return res.json() as Promise<ReceiptsSummaryByDate>;
}