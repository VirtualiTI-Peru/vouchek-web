import { NextRequest, NextResponse } from 'next/server';
import { type User } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import { VOUCHEK_APPLICATION_ID } from '@/lib/auth';
import { canManageUsers } from '@/lib/portal-access';
import { canAccessOrganization, getApiAuthContext, isUuid } from '@/lib/api-auth-context';
import { normalizeVouchekRole } from '@/lib/roles';
import { getUniversalAuthAdmin } from '@/lib/universal-auth-admin';

type UaTenantUserRow = {
  profile_id: string;
  role_id: string;
};

type UaProfileRow = {
  id: string;
  user_id: string;
  full_name?: string | null;
  is_super_admin?: boolean | null;
};

type UaRoleRow = {
  id: string;
  slug?: string | null;
  role?: string | null;
};

async function fetchAuthUserById(userId: string): Promise<User | null> {
  const uaAdmin = getUniversalAuthAdmin();
  const { data, error } = await uaAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return data.user;
}

function splitFullName(fullName?: string | null): { firstName: string; lastName: string } {
  const trimmed = fullName?.trim() ?? '';
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!canManageUsers({ userId: user.id, orgId: callerOrgId ?? '', role, isSuperAdmin })) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const orgId = req.nextUrl.searchParams.get('orgId')?.trim() ?? '';
    if (!orgId) {
      return NextResponse.json({ error: ApiErrors.MISSING_ORG_ID }, { status: 400 });
    }

    if (!isUuid(orgId)) {
      return NextResponse.json({ error: 'Identificador de empresa inválido.' }, { status: 400 });
    }

    if (!canAccessOrganization(isSuperAdmin, callerOrgId, orgId)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const uaAdmin = getUniversalAuthAdmin();

    const { data: assignments, error: assignmentsError } = await uaAdmin
      .from('tenant_users')
      .select('profile_id, role_id')
      .eq('application_id', VOUCHEK_APPLICATION_ID)
      .eq('tenant_id', orgId);

    if (assignmentsError) {
      console.error('org-members UA tenant_users error:', assignmentsError);
      return NextResponse.json({ error: assignmentsError.message }, { status: 500 });
    }

    const rows = (assignments ?? []) as UaTenantUserRow[];
    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    const profileIds = Array.from(new Set(rows.map((row) => row.profile_id)));
    const roleIds = Array.from(new Set(rows.map((row) => row.role_id)));

    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] =
      await Promise.all([
        uaAdmin
          .from('profiles')
          .select('id, user_id, full_name, is_super_admin')
          .in('id', profileIds),
        uaAdmin
          .from('application_roles')
          .select('id, slug, role')
          .in('id', roleIds),
      ]);

    if (profilesError) {
      console.error('org-members UA profiles error:', profilesError);
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }
    if (rolesError) {
      console.error('org-members UA roles error:', rolesError);
      return NextResponse.json({ error: rolesError.message }, { status: 500 });
    }

    const profilesById = new Map(
      ((profiles ?? []) as UaProfileRow[]).map((profile) => [profile.id, profile]),
    );
    const rolesById = new Map(
      ((roles ?? []) as UaRoleRow[]).map((roleRow) => [roleRow.id, roleRow]),
    );

    const userIds = Array.from(
      new Set(
        ((profiles ?? []) as UaProfileRow[])
          .map((profile) => profile.user_id)
          .filter(Boolean),
      ),
    );

    const authUsers = await Promise.all(userIds.map((userId) => fetchAuthUserById(userId)));
    const authUsersById = new Map(
      authUsers.filter((authUser): authUser is User => authUser != null).map((authUser) => [authUser.id, authUser]),
    );

    const formattedMembers = rows
      .map((assignment) => {
        const profile = profilesById.get(assignment.profile_id);
        if (!profile?.user_id) return null;

        const authUser = authUsersById.get(profile.user_id);
        const roleRow = rolesById.get(assignment.role_id);
        const roleSlug =
          normalizeVouchekRole(roleRow?.slug ?? roleRow?.role)
          ?? (roleRow?.slug ?? roleRow?.role ?? '');
        const { firstName, lastName } = splitFullName(profile.full_name);
        const isInvited = !!authUser?.invited_at && !authUser?.last_sign_in_at;

        return {
          id: profile.user_id,
          profileId: profile.id,
          email: authUser?.email ?? '',
          role: roleSlug,
          username: profile.full_name?.trim() || authUser?.email || profile.user_id,
          firstName,
          lastName,
          ...(isSuperAdmin ? { isSuperAdmin: profile.is_super_admin === true } : {}),
          status: isInvited ? 'invitado' : 'activo',
          lastSignInAt: authUser?.last_sign_in_at ?? '',
        };
      })
      .filter(Boolean);

    return NextResponse.json(formattedMembers);
  } catch (err) {
    console.error('org-members API error:', err);
    return NextResponse.json({ error: (err as Error).message || ApiErrors.UNKNOWN }, { status: 500 });
  }
}
