import { getPortalContext } from '@/lib/portalContext';
import { canAccessOrgReports } from '@/lib/portal-access';

export default async function ReceiptsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPortalContext();
  if (!canAccessOrgReports(ctx)) {
    return (
      <div className="rounded border border-default-200 bg-white p-4 text-default-900 dark:border-default-700 dark:bg-card dark:text-white">
        Acceso denegado.
      </div>
    );
  }

  return children;
}
