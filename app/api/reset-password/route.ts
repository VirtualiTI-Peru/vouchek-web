import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { isVouchekRole, VOUCHEK_ROLES } from '@/lib/roles';
import { sendVouchekPasswordReset } from '@/lib/universal-auth-api';
import { getUaTenantMembership, getUniversalAuthAdmin } from '@/lib/universal-auth-admin';

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!isSuperAdmin && !isVouchekRole(role, VOUCHEK_ROLES.SYSADMIN)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const body = await req.json();
    const userId = String(body?.userId ?? '').trim();
    const orgId = String(body?.orgId ?? '').trim();
    const profileIdFromBody = String(body?.profileId ?? '').trim();

    if ((!userId && !profileIdFromBody) || !orgId) {
      return NextResponse.json({ error: ApiErrors.MISSING_USER_OR_ORG }, { status: 400 });
    }

    if (!isSuperAdmin && callerOrgId !== orgId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    let profileId = profileIdFromBody;
    if (!profileId) {
      const uaAdmin = getUniversalAuthAdmin();
      const membership = await getUaTenantMembership({
        admin: uaAdmin,
        userId,
        tenantId: orgId,
      });
      if (!membership) {
        return NextResponse.json({ error: ApiErrors.USER_NOT_IN_ORG }, { status: 400 });
      }
      profileId = membership.profileId;
    }

    const result = await sendVouchekPasswordReset({
      profileId,
      tenantId: orgId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status >= 400 ? result.status : 500 },
      );
    }

    return NextResponse.json({
      success: true,
      email: result.email,
      message: result.message ?? 'Se envió un email para restablecer la contraseña.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
