import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api-errors';
import { normalizeVouchekRole, type VouchekRoleSlug } from '@/lib/roles';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';

export type PortalRole = VouchekRoleSlug | string;

export type PortalContext = {
  userId: string;
  orgId: string;
  email?: string;
  role?: PortalRole;
  isSuperAdmin: boolean;
  fullName?: string;
  termsAcceptedVersion?: string | null;
};

export async function getPortalContext(): Promise<PortalContext> {
  const session = await auth();
  if (!session?.userId && !session?.user?.email) {
    throw new Error(ApiErrors.NOT_AUTHENTICATED);
  }

  const userId = session.userId ?? (session.user as { id?: string } | undefined)?.id;
  if (!userId) {
    throw new Error(ApiErrors.NOT_AUTHENTICATED);
  }

  const isSuperAdmin = session.isSuperAdmin === true;
  const orgId = session.primaryTenantId?.trim() || session.tenantIds?.[0]?.trim() || '';
  const role = normalizeVouchekRole(session.appRoleSlug ?? session.appRole) ?? undefined;
  const email = session.user?.email ?? undefined;
  const fullNameFromSession = session.user?.name?.trim() || undefined;

  let termsAcceptedVersion: string | null = null;
  let fullName = fullNameFromSession;
  let profileSuperAdmin = false;

  try {
    const dataAdmin = getVouchekDataSupabaseAdmin();
    const { data: profile } = await dataAdmin
      .from('profiles')
      .select('first_name, last_name, is_super_admin, terms_accepted_version')
      .eq('user_id', userId)
      .maybeSingle();

    if (profile) {
      const firstName = profile.first_name ?? '';
      const lastName = profile.last_name ?? '';
      const composed = `${firstName} ${lastName}`.trim();
      if (composed) fullName = composed;
      profileSuperAdmin = profile.is_super_admin === true;
      termsAcceptedVersion = profile.terms_accepted_version ?? null;
    }
  } catch {
    // Data plane optional during early UA cutover; JWT still drives access.
  }

  const effectiveSuperAdmin = isSuperAdmin || profileSuperAdmin;

  if (!orgId && !effectiveSuperAdmin) {
    throw new Error('Falta la empresa asociada a tu cuenta');
  }

  return {
    userId,
    orgId,
    email,
    role,
    isSuperAdmin: effectiveSuperAdmin,
    fullName,
    termsAcceptedVersion,
  };
}
