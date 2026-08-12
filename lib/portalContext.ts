import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api-errors';
import { resolveWebTermsDocument, termsVersionKey } from '@/lib/legal';
import { getAcceptedTermsVersion } from '@/lib/legal-api';
import { normalizeVouchekRole, type VouchekRoleSlug } from '@/lib/roles';

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
  const fullName = session.user?.name?.trim() || undefined;

  let termsAcceptedVersion: string | null = null;
  const termsDocument = resolveWebTermsDocument(role, isSuperAdmin);
  const requiredTermsVersion = termsDocument ? termsVersionKey(termsDocument) : null;

  if (requiredTermsVersion) {
    termsAcceptedVersion = await getAcceptedTermsVersion(requiredTermsVersion);
  }

  if (!orgId && !isSuperAdmin) {
    throw new Error('Falta la empresa asociada a tu cuenta');
  }

  return {
    userId,
    orgId,
    email,
    role,
    isSuperAdmin,
    fullName,
    termsAcceptedVersion,
  };
}
