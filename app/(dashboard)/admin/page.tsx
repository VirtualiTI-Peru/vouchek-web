
import { getPortalContext } from '@/lib/portalContext';
import { clerkClient } from '@clerk/clerk-sdk-node';
import UsersTable from '@/app/components/UsersTable';

export default async function AdminPage() {
  const ctx = await getPortalContext();
  if (!ctx.isSuperAdmin && ctx.role !== 'org:admin') {
    return <div className="rounded border bg-white p-4">Forbidden.</div>;
  }

  let organizations: { id: string; name: string }[] = [];
  if (ctx.isSuperAdmin) {
    // Superadmin: fetch all organizations
    const orgList = await clerkClient.organizations.getOrganizationList();
    organizations = orgList.map((org: any) => ({ id: org.id, name: org.name }));
  } else {
    organizations = [{ id: ctx.orgId, name: ctx.orgId }];
  }

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="text-lg font-semibold">Admin</div>
        <div className="text-sm text-slate-600">User management / invitations will be implemented using Clerk server-side APIs.</div>
      </div>

      <div className="rounded border bg-white p-4 text-sm text-slate-700">
        <div className="mb-4">
          <label className="block font-medium mb-1">Organization</label>
          {ctx.isSuperAdmin ? (
            <UsersTable organizations={organizations} />
          ) : (
            <div className="border rounded px-2 py-1 bg-gray-100 text-gray-500 cursor-not-allowed">{organizations[0]?.name}</div>
          )}
        </div>
        <div className="font-medium">Next steps</div>
        <ul className="list-disc pl-5">
          <li>List org users (Clerk organization memberships)</li>
          <li>Invite user by email</li>
          <li>Enforce MaxUsers (X) when inviting</li>
        </ul>
      </div>
    </div>
  );
}
