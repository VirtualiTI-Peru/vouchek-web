import { fetchReceipts } from '@/lib/webapi';
import { getPortalContext } from '@/lib/portalContext';
import ReceiptsTable from '@/app/components/ReceiptsTable';

export default async function ReceiptsPage({ searchParams }: { searchParams: { customerId?: string } }) {
  const ctx = await getPortalContext();
  if (!ctx || (!ctx.isSuperAdmin && ctx.role !== 'org:accountant' && ctx.role !== 'org:admin')) {
    return <div className="rounded border bg-white p-4">Forbidden.</div>;
  }

  const params = await searchParams;
  const receipts = await fetchReceipts(params.customerId);

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="text-lg font-semibold">Receipts</div>
        <div className="text-sm text-slate-600">
          {ctx.isSuperAdmin ? 'Superadmin view' : `Org: ${ctx.orgId}`}
        </div>
      </div>
      <ReceiptsTable receipts={receipts} />
    </div>
  );
}
