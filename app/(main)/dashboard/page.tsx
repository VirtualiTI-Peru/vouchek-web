import DashboardSummary from '@/app/components/DashboardSummary';
import { getPortalContext } from '@/lib/portalContext';
import { canAccessOrgReports, isOwnReceiptsOnly } from '@/lib/portal-access';
import { loadPortalOrganizations } from '@/lib/portal-organizations';
import { fetchReceiptsSummaryByDate } from '@/lib/webapi';
import type { ReceiptsSummaryByDate } from '@/lib/api-types';
import { resolveWorkCustomerId } from '@/lib/work-org';

function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; timezoneOffsetMinutes?: string; customerId?: string }>;
}) {
  const params = await searchParams;
  const today = getTodayLocalDateString();
  const date = params?.date ?? today;
  const timezoneOffsetMinutes = params?.timezoneOffsetMinutes ? Number(params.timezoneOffsetMinutes) : undefined;

  const ctx = await getPortalContext();
  if (!canAccessOrgReports(ctx)) {
    return (
      <div className="rounded border border-default-200 bg-white p-4 text-default-900 dark:border-default-700 dark:bg-card dark:text-white">
        Acceso denegado.
      </div>
    );
  }

  const organizations = await loadPortalOrganizations(ctx);
  const defaultCustomerId = ctx.isSuperAdmin ? (organizations[0]?.id ?? '') : ctx.orgId;
  const customerId = resolveWorkCustomerId(params?.customerId, organizations, defaultCustomerId);

  let data: ReceiptsSummaryByDate | null = null;

  if (customerId) {
    try {
      data = await fetchReceiptsSummaryByDate(
        customerId,
        date,
        Number.isFinite(timezoneOffsetMinutes) ? timezoneOffsetMinutes : undefined,
      );
    } catch {
      // empty state; client will retry
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-default-900">Resumen</h1>
      <DashboardSummary
        customerId={customerId}
        data={data}
        date={date}
        showUserTotals={!isOwnReceiptsOnly(ctx)}
        initialTimezoneOffsetMinutes={Number.isFinite(timezoneOffsetMinutes) ? timezoneOffsetMinutes : undefined}
      />
    </div>
  );
}
