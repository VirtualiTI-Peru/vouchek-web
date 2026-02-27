import { getPortalContext } from '@/lib/portalContext';
import { canAccessOrgReports, isOwnReceiptsOnly } from '@/lib/portal-access';
import { loadPortalOrganizations } from '@/lib/portal-organizations';
import { fetchReceiptsPage } from '@/lib/webapi';
import type { ReceiptPage } from '@/lib/api-types';
import ReceiptsTable from '@/app/components/ReceiptsTable';
import { resolveWorkCustomerId } from '@/lib/work-org';

const INITIAL_RECEIPTS_PAGE_SIZE = Number(process.env.NEXT_PUBLIC_RECEIPTS_PAGE_SIZE) || 50;

function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDate(date?: string): string {
  if (!date) return getTodayLocalDateString();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getTodayLocalDateString();
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    timezoneOffsetMinutes?: string;
    customerId?: string;
    transactionSource?: string;
    userId?: string;
    userName?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedDate = normalizeDate(params?.date);
  const initialTimezoneOffsetMinutes = params?.timezoneOffsetMinutes ? Number(params.timezoneOffsetMinutes) : undefined;
  const initialTransactionSource = params?.transactionSource?.trim() || undefined;
  const initialUserId = params?.userId?.trim() || undefined;
  const initialUserName = params?.userName?.trim() || undefined;

  const ctx = await getPortalContext();
  if (!canAccessOrgReports(ctx)) {
    return (
      <div className="rounded border border-default-200 bg-white p-4 text-default-900 dark:border-default-700 dark:bg-card dark:text-white">
        Acceso denegado.
      </div>
    );
  }

  const ownReceiptsOnly = isOwnReceiptsOnly(ctx);
  const lockedUserId = ownReceiptsOnly ? ctx.userId : undefined;
  const organizations = await loadPortalOrganizations(ctx);
  const defaultCustomerId = ctx.isSuperAdmin ? (organizations[0]?.id ?? '') : ctx.orgId;
  const customerId = resolveWorkCustomerId(params?.customerId, organizations, defaultCustomerId);

  let initialReceiptsPage: ReceiptPage = {
    customerId: '',
    page: 1,
    pageSize: INITIAL_RECEIPTS_PAGE_SIZE,
    hasMore: false,
    lastUpdatedAt: null,
    receipts: [],
    totalCount: 0,
  };

  if (customerId) {
    try {
      initialReceiptsPage = await fetchReceiptsPage(customerId, {
        take: INITIAL_RECEIPTS_PAGE_SIZE,
        date: selectedDate,
        timezoneOffsetMinutes: Number.isFinite(initialTimezoneOffsetMinutes) ? initialTimezoneOffsetMinutes : undefined,
        transactionSource: initialTransactionSource,
        userId: lockedUserId ?? initialUserId,
      });
    } catch {
      initialReceiptsPage = {
        customerId,
        page: 1,
        pageSize: INITIAL_RECEIPTS_PAGE_SIZE,
        hasMore: false,
        lastUpdatedAt: null,
        receipts: [],
        totalCount: 0,
      };
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-default-900">Vouchers</h1>
      <ReceiptsTable
        isSuperAdmin={ctx.isSuperAdmin}
        ownReceiptsOnly={ownReceiptsOnly}
        lockedUserId={lockedUserId}
        initialCustomerId={customerId}
        initialDate={selectedDate}
        initialTimezoneOffsetMinutes={Number.isFinite(initialTimezoneOffsetMinutes) ? initialTimezoneOffsetMinutes : undefined}
        initialTransactionSource={initialTransactionSource}
        initialUserId={lockedUserId ?? initialUserId}
        initialUserName={ownReceiptsOnly ? ctx.fullName : initialUserName}
        initialReceiptsPage={initialReceiptsPage}
      />
    </div>
  );
}
