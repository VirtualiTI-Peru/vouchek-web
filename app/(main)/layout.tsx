import { getPortalContext } from '@/lib/portalContext';
import { canAccessOrgReports, canManageUsers } from '@/lib/portal-access';
import { loadPortalOrganizations } from '@/lib/portal-organizations';
import { isInvalidSessionError } from '@/lib/auth-session';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Toaster } from '@/components/ui/sonner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user) {
    if (isInvalidSessionError(error)) {
      await supabase.auth.signOut();
    }
    redirect('/sign-in');
  }

  const ctx = await getPortalContext();

  const canSeeReports = canAccessOrgReports(ctx);
  const canSeeAdmin = canManageUsers(ctx);
  const canSeeSuper = ctx.isSuperAdmin;
  const organizations = canSeeSuper ? await loadPortalOrganizations(ctx) : [];

  return (
    <DashboardShell
      user={user}
      canSeeReports={canSeeReports}
      canSeeAdmin={canSeeAdmin}
      canSeeSuper={canSeeSuper}
      organizations={organizations}
    >
      {children}
      <Toaster />
    </DashboardShell>
  );
}
