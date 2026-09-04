
import { getPortalContext } from './portalContext';
import { isOwnReceiptsOnly } from './portal-access';
import type { Receipt, ReceiptPage, ReceiptSummary, Customer, ReceiptsSummaryByDate, TotalByUser, SummaryBySource } from './api-types';

type ReceiptPageCacheEntry = {
  expiresAt: number;
  summaryLastUpdatedAt: string | null;
  data?: ReceiptPage;
  pending?: Promise<ReceiptPage>;
};

type ReceiptSummaryCacheEntry = {
  expiresAt: number;
  data?: ReceiptSummary;
  pending?: Promise<ReceiptSummary>;
};

type ReceiptsSummaryByDateCacheEntry = {
  expiresAt: number;
  data?: ReceiptsSummaryByDate;
  pending?: Promise<ReceiptsSummaryByDate>;
};

type FetchReceiptsOptions = {
  forceRefresh?: boolean;
};

type FetchReceiptPageOptions = FetchReceiptsOptions & {
  skip?: number;
  take?: number;
  date?: string;
  timezoneOffsetMinutes?: number;
  transactionSource?: string;
  userId?: string;
  includeDuplicates?: boolean;
};

const RECEIPTS_CACHE_TTL_MS = getReceiptsCacheTtlMs();
const RECEIPTS_SUMMARY_CACHE_TTL_MS = getReceiptsSummaryCacheTtlMs();
const RECEIPTS_SUMMARY_BY_DATE_CACHE_TTL_MS = getReceiptsSummaryByDateCacheTtlMs();
const receiptPagesCache = new Map<string, ReceiptPageCacheEntry>();
const receiptSummaryCache = new Map<string, ReceiptSummaryCacheEntry>();
const receiptsSummaryByDateCache = new Map<string, ReceiptsSummaryByDateCacheEntry>();

function getDefaultPageSize(): number {
  const envValue = process.env.NEXT_PUBLIC_RECEIPTS_PAGE_SIZE;
  const parsed = envValue ? parseInt(envValue, 10) : null;
  return parsed && parsed > 0 ? parsed : 50;
}



export async function fetchReceiptsPage(customerId: string, options: FetchReceiptPageOptions = {}): Promise<ReceiptPage> {
  const normalizedCustomerId = customerId.trim();
  const take = normalizeTake(options.take ?? getDefaultPageSize());
  const skip = normalizeSkip(options.skip ?? 0);

  if (!normalizedCustomerId) {
    return buildEmptyReceiptPage('', skip, take, null);
  }

  const summary = await fetchReceiptsSummary(normalizedCustomerId, {
    forceRefresh: options.forceRefresh,
  });

  const normalizedDate = options.date?.trim();
  const normalizedTimezoneOffsetMinutes = typeof options.timezoneOffsetMinutes === 'number'
    ? options.timezoneOffsetMinutes
    : null;
  const normalizedTransactionSource = options.transactionSource?.trim();
  const normalizedUserId = options.userId?.trim();
  const includeDuplicates = options.includeDuplicates === true;
  const cacheKey = buildReceiptPageCacheKey(
    normalizedCustomerId,
    skip,
    take,
    normalizedDate ?? null,
    normalizedTimezoneOffsetMinutes,
    normalizedTransactionSource ?? null,
    normalizedUserId ?? null,
    includeDuplicates,
  );
  const cachedEntry = receiptPagesCache.get(cacheKey);
  const now = Date.now();

  if (
    !options.forceRefresh &&
    cachedEntry?.data &&
    cachedEntry.expiresAt > now &&
    cachedEntry.summaryLastUpdatedAt === summary.lastUpdatedAt &&
    !pageHasStaleQueuedLabels(cachedEntry.data)
  ) {
    return cachedEntry.data;
  }

  if (cachedEntry?.pending) {
    return cachedEntry.pending;
  }

  const url = new URL('/api/receipts', getApiBaseUrl());
  url.searchParams.set('customerId', normalizedCustomerId);
  url.searchParams.set('skip', String(skip));
  url.searchParams.set('take', String(take));
  if (normalizedDate) {
    url.searchParams.set('date', normalizedDate);
  }
  if (normalizedTransactionSource) {
    url.searchParams.set('transactionSource', normalizedTransactionSource);
  }
  if (normalizedUserId) {
    url.searchParams.set('userId', normalizedUserId);
  }
  if (includeDuplicates) {
    url.searchParams.set('includeDuplicates', 'true');
  }
  if (typeof options.timezoneOffsetMinutes === 'number') {
    url.searchParams.set('timezoneOffsetMinutes', String(options.timezoneOffsetMinutes));
  }

  const pending = apiFetch<ReceiptPage>(url)
    .then((page) => {
      // Defensive: ensure receipts is always an array
      if (!Array.isArray(page.receipts)) page.receipts = [];
      page.receipts = page.receipts.map((row) => {
        const anyRow = row as Receipt & {
          ParentReceiptId?: string | null;
          TransactionOperationNumber?: string | null;
        };
        const parentReceiptId = row.parentReceiptId ?? anyRow.ParentReceiptId ?? null;
        const transactionOperationNumber =
          (row.transactionOperationNumber ?? anyRow.TransactionOperationNumber ?? '').trim() || undefined;
        return {
          ...row,
          parentReceiptId: parentReceiptId?.trim() ? parentReceiptId : null,
          transactionOperationNumber,
        };
      });
      const anyPage = page as ReceiptPage & { TotalCount?: number };
      page.totalCount = Number(page.totalCount ?? anyPage.TotalCount ?? 0);
      page.pageSize = take;
      page.page = Math.floor(skip / take) + 1;
      page.hasMore = skip + page.receipts.length < page.totalCount;
      page.lastUpdatedAt = page.lastUpdatedAt ?? summary.lastUpdatedAt;
      if (pageLooksUnresolvedProcessing(page)) {
        receiptPagesCache.delete(cacheKey);
        return page;
      }
      receiptPagesCache.set(cacheKey, {
        data: page,
        expiresAt: Date.now() + RECEIPTS_CACHE_TTL_MS,
        summaryLastUpdatedAt: summary.lastUpdatedAt,
      });
      return page;
    })
    .catch((error) => {
      const activeEntry = receiptPagesCache.get(cacheKey);
      if (activeEntry?.pending === pending) {
        receiptPagesCache.delete(cacheKey);
      }
      throw error;
    });

  receiptPagesCache.set(cacheKey, {
    data: cachedEntry?.data,
    expiresAt: cachedEntry?.expiresAt ?? 0,
    summaryLastUpdatedAt: summary.lastUpdatedAt,
    pending,
  });

  return pending;
}

export async function fetchReceiptsSummary(customerId: string, options: FetchReceiptsOptions = {}): Promise<ReceiptSummary> {
  const normalizedCustomerId = customerId.trim();
  if (!normalizedCustomerId) {
    return { customerId: '', lastUpdatedAt: null };
  }

  const cachedEntry = receiptSummaryCache.get(normalizedCustomerId);
  const now = Date.now();

  if (!options.forceRefresh && cachedEntry?.data && cachedEntry.expiresAt > now) {
    return cachedEntry.data;
  }

  if (cachedEntry?.pending) {
    return cachedEntry.pending;
  }

  const url = new URL('/api/receipts/summary', getApiBaseUrl());
  url.searchParams.set('customerId', normalizedCustomerId);

  const pending = apiFetch<ReceiptSummary>(url)
    .then((summary) => {
      const normalizedSummary = {
        customerId: summary.customerId || normalizedCustomerId,
        lastUpdatedAt: summary.lastUpdatedAt ?? null,
      } satisfies ReceiptSummary;

      receiptSummaryCache.set(normalizedCustomerId, {
        data: normalizedSummary,
        expiresAt: Date.now() + RECEIPTS_SUMMARY_CACHE_TTL_MS,
      });

      return normalizedSummary;
    })
    .catch((error) => {
      const activeEntry = receiptSummaryCache.get(normalizedCustomerId);
      if (activeEntry?.pending === pending) {
        receiptSummaryCache.delete(normalizedCustomerId);
      }
      throw error;
    });

  receiptSummaryCache.set(normalizedCustomerId, {
    data: cachedEntry?.data,
    expiresAt: cachedEntry?.expiresAt ?? 0,
    pending,
  });

  return pending;
}

export async function fetchCustomers(): Promise<Customer[]> {
  const { loadPortalOrganizations } = await import('@/lib/portal-organizations');
  const ctx = await getPortalContext();
  const orgs = await loadPortalOrganizations(ctx);
  return orgs.map((org) => ({
    customerId: org.id,
    customerName: org.name,
  }));
}

export async function fetchReceiptsSummaryByDate(customerId: string, date: string, timezoneOffsetMinutes?: number): Promise<ReceiptsSummaryByDate> {
  const ctx = await getPortalContext();
  const ownOnly = isOwnReceiptsOnly(ctx);
  const viewerScope = ownOnly ? `user:${ctx.userId}` : 'org';

  const normalizedCustomerId = customerId.trim();
  const normalizedDate = date.trim();
  const normalizedTimezoneOffsetMinutes = typeof timezoneOffsetMinutes === 'number'
    ? timezoneOffsetMinutes
    : null;

  const cacheKey = buildReceiptsSummaryByDateCacheKey(
    normalizedCustomerId,
    normalizedDate,
    normalizedTimezoneOffsetMinutes,
    viewerScope,
  );
  const cachedEntry = receiptsSummaryByDateCache.get(cacheKey);
  const now = Date.now();

  if (cachedEntry?.data && cachedEntry.expiresAt > now) {
    return cachedEntry.data;
  }

  if (cachedEntry?.pending) {
    return cachedEntry.pending;
  }

  const url = new URL(`/api/receipts/${encodeURIComponent(customerId)}/summary-by-date`, getApiBaseUrl());
  url.searchParams.set('date', date);
  if (typeof timezoneOffsetMinutes === 'number') {
    url.searchParams.set('timezoneOffsetMinutes', String(timezoneOffsetMinutes));
  }

  const pending = apiFetch<ReceiptsSummaryByDate>(url)
    .then((summary) => {
      const scoped = ownOnly
        ? filterSummaryByUser(summary, ctx.userId)
        : normalizeSummaryByDate(summary);
      receiptsSummaryByDateCache.set(cacheKey, {
        data: scoped,
        expiresAt: Date.now() + RECEIPTS_SUMMARY_BY_DATE_CACHE_TTL_MS,
      });
      return scoped;
    })
    .catch((error) => {
      const activeEntry = receiptsSummaryByDateCache.get(cacheKey);
      if (activeEntry?.pending === pending) {
        receiptsSummaryByDateCache.delete(cacheKey);
      }
      throw error;
    });

  receiptsSummaryByDateCache.set(cacheKey, {
    data: cachedEntry?.data,
    expiresAt: cachedEntry?.expiresAt ?? 0,
    pending,
  });

  return pending;
}

// --- Helpers ---


function getApiBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) throw new Error('Missing API_BASE_URL');
  return baseUrl;
}

function getReceiptsCacheTtlMs(): number {
  const ttlSeconds = Number(process.env.RECEIPTS_CACHE_TTL_SECONDS ?? '30');
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return 30_000;
  }
  return Math.round(ttlSeconds * 1000);
}

function getReceiptsSummaryCacheTtlMs(): number {
  const ttlSeconds = Number(process.env.RECEIPTS_SUMMARY_CACHE_TTL_SECONDS ?? '20');
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return 20_000;
  }
  return Math.round(ttlSeconds * 1000);
}

function getReceiptsSummaryByDateCacheTtlMs(): number {
  const ttlSeconds = Number(process.env.RECEIPTS_SUMMARY_BY_DATE_CACHE_TTL_SECONDS ?? '20');
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return 20_000;
  }
  return Math.round(ttlSeconds * 1000);
}

function buildReceiptPageCacheKey(customerId: string, skip: number, take: number, date: string | null, timezoneOffsetMinutes: number | null, transactionSource: string | null, userId: string | null, includeDuplicates = false): string {
  return `${customerId}:${date ?? 'all'}:${timezoneOffsetMinutes ?? 'na'}:${transactionSource ?? 'all'}:${userId ?? 'all'}:${includeDuplicates ? 'dups' : 'orig'}:${skip}:${take}`;
}

function buildReceiptsSummaryByDateCacheKey(
  customerId: string,
  date: string,
  timezoneOffsetMinutes: number | null,
  viewerScope: string,
): string {
  return `${customerId}:${date}:${timezoneOffsetMinutes ?? 'na'}:${viewerScope}`;
}

function mapTotalByUser(row: TotalByUser & {
  UserId?: string;
  TransactionSource?: string;
  TotalAmount?: number;
  FullName?: string;
  ReceiptCount?: number;
}): TotalByUser {
  return {
    userId: String(row.userId ?? row.UserId ?? ''),
    transactionSource: String(row.transactionSource ?? row.TransactionSource ?? 'Sin clasificar'),
    receiptCount: Number(row.receiptCount ?? row.ReceiptCount ?? 0),
    totalAmount: Number(row.totalAmount ?? row.TotalAmount ?? 0),
    fullName: String(row.fullName ?? row.FullName ?? ''),
  };
}

function normalizeSummaryByDate(summary: ReceiptsSummaryByDate): ReceiptsSummaryByDate {
  const anySummary = summary as ReceiptsSummaryByDate & {
    SummaryBySource?: SummaryBySource[];
    TotalsByUser?: TotalByUser[];
  };
  const totalsByUser = (Array.isArray(summary.totalsByUser) ? summary.totalsByUser : anySummary.TotalsByUser ?? [])
    .map((row) => mapTotalByUser(row));
  const summaryBySource = Array.isArray(summary.summaryBySource)
    ? summary.summaryBySource
    : anySummary.SummaryBySource ?? [];
  return {
    summaryBySource,
    totalsByUser,
  };
}

function filterSummaryByUser(summary: ReceiptsSummaryByDate, userId: string): ReceiptsSummaryByDate {
  const normalized = normalizeSummaryByDate(summary);
  const totalsByUser = normalized.totalsByUser.filter((row) => {
    return row.userId === userId;
  });

  const amountBySource = new Map<string, number>();
  for (const row of totalsByUser) {
    amountBySource.set(
      row.transactionSource,
      (amountBySource.get(row.transactionSource) ?? 0) + row.totalAmount,
    );
  }

  return {
    summaryBySource: Array.from(amountBySource.entries()).map(([transactionSource, totalAmount]) => ({
      transactionSource,
      totalAmount,
    })),
    totalsByUser,
  };
}

function buildEmptyReceiptPage(customerId: string, skip: number, take: number, lastUpdatedAt: string | null): ReceiptPage {
  return {
    customerId,
    page: Math.floor(skip / take) + 1,
    pageSize: take,
    hasMore: false,
    lastUpdatedAt,
    receipts: [],
    totalCount: 0,
  };
}

function pageHasStaleQueuedLabels(page: ReceiptPage): boolean {
  return pageLooksUnresolvedProcessing(page);
}

function pageLooksUnresolvedProcessing(page: ReceiptPage): boolean {
  return page.receipts.some((r) => {
    const hasOrigin = Boolean(r.transactionSource?.trim());
    const hasOcr = Boolean(r.ocrText?.trim());
    const hasAmount = typeof r.transactionAmount === 'number' && r.transactionAmount > 0;
    if (hasOrigin || hasOcr || hasAmount) {
      return r.parseStatus === 'Queued';
    }
    return r.parseStatus !== 'Parsed';
  });
}

function normalizeTake(take: number): number {
  return Math.min(Math.max(Math.trunc(take) || 50, 1), 200);
}

function normalizeSkip(skip: number): number {
  return Math.max(Math.trunc(skip) || 0, 0);
}

async function getAuthToken(): Promise<string> {
  const { getServerAccessToken } = await import('@/lib/server-auth-token');
  const token = await getServerAccessToken();
  if (!token) throw new Error('Missing auth token');
  return token;
}

async function apiFetch<T>(url: URL, options?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  // Ensure url is a string before calling startsWith
  const urlStr = typeof url === 'string' ? url : url.toString();
  const isAzuriteBlob = urlStr.startsWith('http://127.0.0.1:10000/');
  const headers = new Headers(options?.headers);
  if (!isAzuriteBlob) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error('API error:', res.status, errorText);
    throw new Error(errorText || `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

