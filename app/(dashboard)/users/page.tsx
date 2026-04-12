import { getPortalContext } from '@/lib/portalContext';
import { createClient } from '@supabase/supabase-js';
import UsersTable from '@/app/components/UsersTable';

export default async function AdminPage() {
  const ctx = await getPortalContext();
  if (!ctx.isSuperAdmin && ctx.role !== 'org:admin' && ctx.role !== 'org:sistema') {
    return <div className="rounded border bg-white p-4">Acceso denegado.</div>;
  }

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
    organizations = (orgs ?? []).map((o: any) => ({ id: o.id, name: o.name ?? o.id }));
    if (!ctx.isSuperAdmin) {
      organizations = organizations.filter(o => o.id === ctx.orgId);
    }
  } catch { /* leave empty */ }

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="text-lg font-semibold">Usuarios</div>
      </div>

      <div className="rounded border bg-white p-4 text-sm text-slate-700">
        <div className="mb-4">
          {ctx.role === 'org:sistema' && !ctx.isSuperAdmin ? null : <label className="block font-medium mb-1">Empresa</label>}
          <UsersTable organizations={organizations} showOrganizationSelector={!(ctx.role === 'org:sistema' && !ctx.isSuperAdmin)} />
        </div>
      </div>
    </div>
  );
}
