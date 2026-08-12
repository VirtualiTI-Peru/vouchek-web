import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { mapSupabaseError } from '@/lib/auth-errors';
import { VOUCHEK_APPLICATION_ID } from '@/lib/auth';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { isVouchekRole, VOUCHEK_ROLES } from '@/lib/roles';
import {
  getUaTenantMembership,
  getUniversalAuthAdmin,
} from '@/lib/universal-auth-admin';

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

    if (!userId || !orgId) {
      return NextResponse.json({ error: ApiErrors.MISSING_USER_OR_ORG }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'No puedes eliminar tu propio usuario.' }, { status: 400 });
    }

    if (!isSuperAdmin && callerOrgId !== orgId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const uaAdmin = getUniversalAuthAdmin();

    const [{ data: targetUserData, error: userError }, membership] = await Promise.all([
      uaAdmin.auth.admin.getUserById(userId),
      getUaTenantMembership({ admin: uaAdmin, userId, tenantId: orgId }),
    ]);

    if (userError || !targetUserData?.user) {
      return NextResponse.json({ error: userError?.message || ApiErrors.USER_NOT_FOUND }, { status: 404 });
    }

    if (!membership) {
      return NextResponse.json({ error: ApiErrors.USER_NOT_IN_ORG }, { status: 400 });
    }

    if (membership.isSuperAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Solo un superadmin puede eliminar otro superadmin.' }, { status: 403 });
    }

    // Remove UA tenant assignment first.
    await uaAdmin
      .from('tenant_users')
      .delete()
      .eq('application_id', VOUCHEK_APPLICATION_ID)
      .eq('tenant_id', orgId)
      .eq('profile_id', membership.profileId);

    const { error: deleteAuthError } = await uaAdmin.auth.admin.deleteUser(userId);

    if (!deleteAuthError) {
      return NextResponse.json({ success: true, softDeleted: false });
    }

    const { error: softDeleteError } = await uaAdmin.auth.admin.deleteUser(userId, true);
    if (softDeleteError) {
      return NextResponse.json(
        { error: mapSupabaseError(softDeleteError.message || deleteAuthError.message) || ApiErrors.DELETE_AUTH_USER },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, softDeleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
