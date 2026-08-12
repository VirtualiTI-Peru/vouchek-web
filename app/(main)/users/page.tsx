import { Suspense } from 'react';
import { getPortalContext } from '@/lib/portalContext';
import { canManageUsers } from '@/lib/portal-access';
import { loadPortalOrganizations } from '@/lib/portal-organizations';
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

  const organizations = await loadPortalOrganizations(ctx);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-default-900">Usuarios</h1>
      {!ctx.orgId && !ctx.isSuperAdmin ? (
        <p className="text-sm text-default-500">
          No hay una organización activa en la sesión.
        </p>
      ) : organizations.length === 0 ? (
        <p className="text-sm text-default-500">
          No hay empresas con VouChek asignado.
        </p>
      ) : (
        <Suspense fallback={<p className="text-sm text-default-500">Cargando usuarios…</p>}>
          <UsersTable
            organizations={organizations}
            isSuperAdmin={ctx.isSuperAdmin}
            ownOrgId={ctx.orgId}
          />
        </Suspense>
      )}
    </div>
  );
}
