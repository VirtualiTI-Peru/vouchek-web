import { getPortalContext } from '@/lib/portalContext';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPortalContext();

  const canSeeAdmin = ctx.isSuperAdmin || ctx.role === 'org:admin';
  const canSeeSuper = ctx.isSuperAdmin;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
