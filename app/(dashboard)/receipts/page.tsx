import { fetchReceipts } from '@/lib/webapi';
import { getPortalContext } from '@/lib/portalContext';
import ReceiptsTable from '@/app/components/ReceiptsTable';
import { clerkClient } from '@clerk/clerk-sdk-node';

export default async function ReceiptsPage() {
  const ctx = await getPortalContext();
  if (!ctx || (!ctx.isSuperAdmin && ctx.role !== 'org:sistema' && ctx.role !== 'org:verificador' && ctx.role !== 'org:admin')) {
    return <div className="rounded border bg-white p-4">Acceso denegado.</div>;
  }

  // Fetch organizations server-side
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
        <div className="text-lg font-semibold">Vouchers</div>
      </div>
      {/* Pass organizations as prop to ReceiptsTable (client component) */}
      <ReceiptsTable organizations={organizations} />
    </div>
  );
}
