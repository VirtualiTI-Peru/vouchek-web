import type { Receipt, ReceiptsSummaryByDate } from './api-types';
import { ApiErrors } from './api-errors';

function normalizeReceipt(row: Receipt): Receipt {
  const anyRow = row as Receipt & { ParentReceiptId?: string | null };
  const parentReceiptId = row.parentReceiptId ?? anyRow.ParentReceiptId ?? null;
  return {
    ...row,
    parentReceiptId: parentReceiptId?.trim() ? parentReceiptId : null,
  };
}

// Fetch all receipts for a customer using the public API route (client/browser safe)
export async function fetchReceipts(customerId: string, options: { forceRefresh?: boolean; date?: string; timezoneOffsetMinutes?: number; transactionSource?: string; userId?: string; includeDuplicates?: boolean } = {}): Promise<Receipt[]> {
  let allReceipts: Receipt[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;
  const maxPages = 50;
  while (hasMore && page <= maxPages) {
    const params = new URLSearchParams({
      customerId,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (options.forceRefresh) params.set('refresh', '1');
    if (options.date) params.set('date', options.date);
    if (options.transactionSource) params.set('transactionSource', options.transactionSource);
    if (options.userId) params.set('userId', options.userId);
    if (options.includeDuplicates) params.set('includeDuplicates', 'true');
    if (typeof options.timezoneOffsetMinutes === 'number') {
      params.set('timezoneOffsetMinutes', String(options.timezoneOffsetMinutes));
    }
    const res = await fetch(`/api/receipts?${params.toString()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? ApiErrors.FETCH_RECEIPTS);
    }
    const data = await res.json();
    const receipts = Array.isArray(data.receipts) ? data.receipts.map((row: Receipt) => normalizeReceipt(row)) : [];
    allReceipts = allReceipts.concat(receipts);
    const totalCount = Number(data.totalCount ?? 0);
    hasMore = receipts.length > 0 && (Boolean(data.hasMore) || (totalCount > 0 && allReceipts.length < totalCount));
    page++;
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
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? ApiErrors.FETCH_RECEIPTS_SUMMARY_BY_DATE);
  }

  return res.json() as Promise<ReceiptsSummaryByDate>;
}