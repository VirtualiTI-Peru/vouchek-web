import { getPortalContext } from '@/lib/portalContext';
import { canManageUsers } from '@/lib/portal-access';
import { isVouchekRole, VOUCHEK_ROLES } from '@/lib/roles';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';
import UsersTable from '@/app/components/UsersTable';

export default async function AdminPage() {
  const ctx = await getPortalContext();
  if (!canManageUsers(ctx)) {
    return (
      <div className="rounded border border-default-200 bg-white p-4 text-default-900 dark:border-default-700 dark:bg-card dark:text-white">
        Acceso denegado.
      </div>
    );
  }

  let organizations: { id: string; name: string }[] = [];
  try {
    const supabaseAdmin = getVouchekDataSupabaseAdmin();
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .order('name', { ascending: true });
    organizations = (orgs ?? []).map((o: { id: string; name?: string }) => ({
      id: o.id,
      name: o.name ?? o.id,
    }));
    if (!ctx.isSuperAdmin) {
      organizations = organizations.filter((o) => o.id === ctx.orgId);
    }
  } catch {
    /* leave empty */
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-default-900">Usuarios</h1>
      <UsersTable
        organizations={organizations}
        showOrganizationSelector={!(isVouchekRole(ctx.role, VOUCHEK_ROLES.SISTEMA) && !ctx.isSuperAdmin)}
        isSuperAdmin={ctx.isSuperAdmin}
      />
    </div>
  );
}
