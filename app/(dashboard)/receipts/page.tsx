import { getPortalContext } from '@/lib/portalContext';
import ReceiptsTable from '@/app/components/ReceiptsTable';
import { createClient } from '@supabase/supabase-js';

export default async function ReceiptsPage() {
  const ctx = await getPortalContext();
  if (!ctx || (!ctx.isSuperAdmin && ctx.role !== 'org:sistema' && ctx.role !== 'org:verificador' && ctx.role !== 'org:admin')) {
    return <div className="rounded border bg-white p-4">Acceso denegado.</div>;
  }

  // Fetch organizations from Supabase
  let organizations: { id: string; name: string }[] = [];
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

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="text-lg font-semibold">Vouchers</div>
      </div>
      {/* Pass organizations as prop to ReceiptsTable (client component) */}
      <ReceiptsTable organizations={organizations} showOrganizationSelector={ctx.isSuperAdmin} />
    </div>
  );
}
