import { fetchReceipts } from '@/lib/webapi';
import { getPortalContext } from '@/lib/portalContext';
import ReceiptsTable from '@/app/components/ReceiptsTable';

export default async function ReceiptsPage() {
  const ctx = await getPortalContext();
  
  if (!ctx || (!ctx.isSuperAdmin && ctx.role !== 'org:sistema' && ctx.role !== 'org:verificador' && ctx.role !== 'org:admin')) {
    return <div className="rounded border bg-white p-4">Acceso denegado.</div>;
  }

  const receipts = await fetchReceipts(ctx.orgId);

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="text-lg font-semibold">Vouchers</div>
        <div className="text-sm text-slate-600">
          {ctx.isSuperAdmin ? 'Superadmin view' : `Org: ${ctx.orgId}`}
        </div>
      </div>
      <ReceiptsTable receipts={receipts} />
    </div>
  );
}
