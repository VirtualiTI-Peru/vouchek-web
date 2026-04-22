import { getPortalContext } from '@/lib/portalContext';
import { fetchReceiptsPage } from '@/lib/webapi';
import type { ReceiptPage } from '@/lib/api-types';
import ReceiptsTable from '@/app/components/ReceiptsTableMantine';
import { createClient } from '@supabase/supabase-js';

const INITIAL_RECEIPTS_PAGE_SIZE = Number(process.env.NEXT_PUBLIC_RECEIPTS_PAGE_SIZE) || 50;

export default async function ReceiptsPage() {
  const ctx = await getPortalContext();
  if (!ctx || (!ctx.isSuperAdmin && ctx.role !== 'org:sistema' && ctx.role !== 'org:verificador' && ctx.role !== 'org:admin')) {
    return <div className="rounded border bg-white p-4">Acceso denegado.</div>;
  }

  let organizations: { id: string; name: string }[] = [];
  let initialReceiptsPage: ReceiptPage = {
    customerId: '',
    page: 1,
    pageSize: INITIAL_RECEIPTS_PAGE_SIZE,
    hasMore: false,
    lastUpdatedAt: null,
    receipts: [],
    totalCount: 0,
  };

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .order('name', { ascending: true });

    const allOrganizations = (orgs ?? []).map((o: any) => ({ id: o.id, name: o.name ?? o.id }));
    if (!ctx.isSuperAdmin) {
      const ownOrganization = allOrganizations.find(o => o.id === ctx.orgId);
      organizations = ownOrganization
        ? [ownOrganization]
        : [{ id: ctx.orgId, name: ctx.orgId }];
    } else {
      organizations = allOrganizations;
    }
  } catch { /* leave empty */ }

  const initialOrgId = organizations[0]?.id;
  if (initialOrgId) {
    try {
      initialReceiptsPage = await fetchReceiptsPage(initialOrgId, {
        take: INITIAL_RECEIPTS_PAGE_SIZE,
      });
    } catch {
      initialReceiptsPage = {
        customerId: initialOrgId,
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
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="text-lg font-semibold">Vouchers</div>
      </div>
      <ReceiptsTable
        organizations={organizations}
        showOrganizationSelector={ctx.isSuperAdmin}
        isSuperAdmin={ctx.isSuperAdmin}
      />
    </div>
  );
}
