import DashboardSummary from '@/app/components/DashboardSummary';
import OrganizationUsageWidget from '@/app/components/OrganizationUsageWidget';
import { getPortalContext } from '@/lib/portalContext';
import { canAccessOrgReports, canViewOrgPlanUsage, isOwnReceiptsOnly } from '@/lib/portal-access';
import { loadPortalOrganizations } from '@/lib/portal-organizations';
import { fetchReceiptsSummaryByDate } from '@/lib/webapi';
import type { ReceiptsSummaryByDate } from '@/lib/api-types';
import { resolveWorkCustomerId } from '@/lib/work-org';
import { createClient } from '@supabase/supabase-js';
import { getOrganizationUsage, type OrganizationUsage } from '@/lib/organization-limits';

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
  let usage: OrganizationUsage | null = null;

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

    if (canViewOrgPlanUsage(ctx)) {
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        usage = await getOrganizationUsage(supabaseAdmin, customerId);
      } catch {
        usage = null;
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-default-900">Resumen</h1>
      {usage ? <OrganizationUsageWidget usage={usage} /> : null}
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
