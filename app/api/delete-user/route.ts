import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { mapSupabaseError } from '@/lib/auth-errors';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { isVouchekRole, VOUCHEK_ROLES } from '@/lib/roles';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';
import { getUniversalAuthAdmin } from '@/lib/universal-auth-admin';

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!isSuperAdmin && !isVouchekRole(role, VOUCHEK_ROLES.ADMIN, VOUCHEK_ROLES.SISTEMA)) {
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

    const dataAdmin = getVouchekDataSupabaseAdmin();
    const uaAdmin = getUniversalAuthAdmin();

    const [
      { data: targetUserData, error: userError },
      { data: targetProfile, error: profileError },
      { data: membership },
    ] = await Promise.all([
      uaAdmin.auth.admin.getUserById(userId),
      dataAdmin.from('profiles').select('is_super_admin').eq('user_id', userId).maybeSingle(),
      dataAdmin
        .from('organization_members')
        .select('org_id')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .maybeSingle(),
    ]);

    if (userError || !targetUserData?.user) {
      return NextResponse.json({ error: userError?.message || ApiErrors.USER_NOT_FOUND }, { status: 404 });
    }

    if (profileError) {
      return NextResponse.json({ error: profileError.message || ApiErrors.VALIDATE_USER_PROFILE }, { status: 500 });
    }

    if (targetProfile?.is_super_admin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Solo un superadmin puede eliminar otro superadmin.' }, { status: 403 });
    }

    if (!membership) {
      return NextResponse.json({ error: ApiErrors.USER_NOT_IN_ORG }, { status: 400 });
    }

    // Remove dependent app rows before deleting auth user to avoid FK failures.
    const cleanupResults = await Promise.allSettled([
      dataAdmin.from('organization_members').delete().eq('user_id', userId),
      dataAdmin.from('profiles').delete().eq('user_id', userId),
    ]);

    for (const result of cleanupResults) {
      if (result.status === 'rejected') {
        return NextResponse.json({ error: ApiErrors.CLEANUP_USER }, { status: 500 });
      }

      if (result.value.error) {
        return NextResponse.json({ error: result.value.error.message || ApiErrors.CLEANUP_USER }, { status: 500 });
      }
    }

    const { error: deleteAuthError } = await uaAdmin.auth.admin.deleteUser(userId);

    if (!deleteAuthError) {
      return NextResponse.json({ success: true, softDeleted: false });
    }

    // Fallback for schemas where hard-delete is blocked by remaining relations.
    const { error: softDeleteError } = await uaAdmin.auth.admin.deleteUser(userId, true);
    if (softDeleteError) {
      return NextResponse.json(
        { error: mapSupabaseError(softDeleteError.message || deleteAuthError.message) || ApiErrors.DELETE_AUTH_USER },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, softDeleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
