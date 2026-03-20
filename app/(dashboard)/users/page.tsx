import { getPortalContext } from '@/lib/portalContext';
import { clerkClient } from '@clerk/clerk-sdk-node';
import UsersTable from '@/app/components/UsersTable';

export default async function AdminPage() {
  const ctx = await getPortalContext();
  if (!ctx.isSuperAdmin && ctx.role !== 'org:admin' && ctx.role !== 'org:sistema') {
    return <div className="rounded border bg-white p-4">Acceso denegado.</div>;
  }

  let organizations: { id: string; name: string }[] = [];
  const orgList = await clerkClient.organizations.getOrganizationList();
  if (ctx.isSuperAdmin) {
    organizations = orgList.map((org: any) => ({ id: org.id, name: org.name }));
  } else {
    organizations = orgList.filter((org: any) => org.id === ctx.orgId).map((org: any) => ({ id: org.id, name: org.name }));
  }

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="text-lg font-semibold">Usuarios</div>
      </div>

      <div className="rounded border bg-white p-4 text-sm text-slate-700">
        <div className="mb-4">
          <label className="block font-medium mb-1">Empresa</label>
          <UsersTable organizations={organizations} />
        </div>
      </div>
    </div>
  );
}
