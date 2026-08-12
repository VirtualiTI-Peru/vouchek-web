import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { VOUCHEK_APPLICATION_ID } from '@/lib/auth';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { isVouchekRole, normalizeVouchekRole, VOUCHEK_ROLES } from '@/lib/roles';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';
import {
  assignTenantUser,
  ensureUaProfile,
  getUaTenantMembership,
  getUniversalAuthAdmin,
} from '@/lib/universal-auth-admin';

const ALLOWED_ROLES = new Set([
  VOUCHEK_ROLES.TRANSPORTISTA,
  VOUCHEK_ROLES.VERIFICADOR,
  VOUCHEK_ROLES.SYSADMIN,
]);

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role: callerRole, orgId: callerOrgId } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!isSuperAdmin && !isVouchekRole(callerRole, VOUCHEK_ROLES.SYSADMIN)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const body = await req.json();
    const userId = String(body?.userId ?? '').trim();
    const orgId = String(body?.orgId ?? '').trim();
    const firstName = String(body?.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();
    const normalizedRole = normalizeVouchekRole(String(body?.role ?? '').trim());
    const requestedIsSuperAdmin = body?.isSuperAdmin === true;

    if (!userId || !orgId || !firstName || !lastName || !normalizedRole) {
      return NextResponse.json({ error: ApiErrors.MISSING_REQUIRED_FIELDS }, { status: 400 });
    }

    if (!ALLOWED_ROLES.has(normalizedRole)) {
      return NextResponse.json({ error: 'Rol no válido.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Solo un superadmin puede editar otro superadmin.' }, { status: 403 });
    }

    if (requestedIsSuperAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Solo un superadmin puede asignar el rol de superadmin.' }, { status: 403 });
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const nextIsSuperAdmin = isSuperAdmin
      ? requestedIsSuperAdmin
      : membership.isSuperAdmin;

    try {
      const profileId = await ensureUaProfile(uaAdmin, userId, fullName);
      await uaAdmin
        .from('profiles')
        .update({
          full_name: fullName,
          is_super_admin: nextIsSuperAdmin,
        })
        .eq('id', profileId);

      await uaAdmin
        .from('tenant_users')
        .delete()
        .eq('application_id', VOUCHEK_APPLICATION_ID)
        .eq('tenant_id', orgId)
        .eq('profile_id', profileId);

      await assignTenantUser({
        admin: uaAdmin,
        profileId,
        tenantId: orgId,
        roleSlug: normalizedRole,
      });
    } catch (assignError: unknown) {
      const message = assignError instanceof Error ? assignError.message : ApiErrors.SAVE_PROFILE;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // Best-effort mirror to legacy data-plane tables (optional during UA cutover).
    try {
      const dataAdmin = getVouchekDataSupabaseAdmin();
      await dataAdmin.from('profiles').upsert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        is_super_admin: nextIsSuperAdmin,
      }, { onConflict: 'user_id' });

      await dataAdmin
        .from('organization_members')
        .upsert({
          org_id: orgId,
          user_id: userId,
          role: normalizedRole,
          status: 'active',
        }, { onConflict: 'org_id,user_id' });
    } catch (syncError) {
      console.warn('VouChek data-plane sync after update-user failed:', syncError);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
