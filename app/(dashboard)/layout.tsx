import { AppShell, AppShellHeader, AppShellNavbar, AppShellMain } from '@mantine/core'
import { getPortalContext } from '@/lib/portalContext'
import { AppNavbar } from '../../components/layout/Navbar'
import { ClientHeader } from '../../components/layout/ClientHeader'
import { AppBreadcrumbs } from '../../components/layout/Breadcrumbs'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPortalContext();

  const canSeeAdmin = ctx.isSuperAdmin || ctx.role === 'org:admin';
  const canSeeSuper = ctx.isSuperAdmin;

  // Get user data for header
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShellHeader>
        <ClientHeader user={user} />
      </AppShellHeader>

      <AppShellNavbar>
        <AppNavbar />
      </AppShellNavbar>

      <AppShellMain>
        <div className="p-4">
          <AppBreadcrumbs />
        </div>
        {children}
      </AppShellMain>
    </AppShell>
  );
}
