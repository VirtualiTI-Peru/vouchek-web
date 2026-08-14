import { getPortalContext } from '@/lib/portalContext';
import { getOrganizationAccessStatus } from '@/lib/organization-access';
import { canAccessOrgReports, canManageUsers, canViewOrgPlanUsage } from '@/lib/portal-access';
import { loadPortalOrganizations } from '@/lib/portal-organizations';
import { hasAcceptedCurrentTerms, resolveWebTermsDocument } from '@/lib/legal';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Toaster } from '@/components/ui/sonner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/sign-in');
  }

  const ctx = await getPortalContext();

  // Bloqueo por demo/suscripción vencida o empresa inactiva (superadmin exento).
  if (!ctx.isSuperAdmin && ctx.orgId) {
    const access = await getOrganizationAccessStatus(ctx.orgId);
    if (access.blocked) {
      redirect(access.overdueInvoice ? "/cuenta-suspendida?motivo=factura" : "/cuenta-suspendida");
    }
  }

  const canSeeReports = canAccessOrgReports(ctx);
  const canSeeAdmin = canManageUsers(ctx);
  const canSeeSuper = ctx.isSuperAdmin;
  const canSeeUsage = canViewOrgPlanUsage(ctx);
  const organizations = await loadPortalOrganizations(ctx);

  const termsDocument = resolveWebTermsDocument(ctx.role, ctx.isSuperAdmin);
  const needsTerms = !hasAcceptedCurrentTerms(ctx.termsAcceptedVersion, termsDocument);

  const shellUser = {
    id: ctx.userId,
    email: ctx.email,
  };

  return (
    <DashboardShell
      user={shellUser}
      displayName={ctx.fullName}
      canSeeReports={canSeeReports}
      canSeeAdmin={canSeeAdmin}
      canSeeSuper={canSeeSuper}
      canSeeUsage={canSeeUsage}
      orgId={ctx.orgId}
      organizations={organizations}
      termsDocument={needsTerms ? termsDocument : null}
    >
      {children}
      <Toaster />
    </DashboardShell>
  );
}
