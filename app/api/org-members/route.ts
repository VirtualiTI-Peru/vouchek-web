import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import { canManageUsers } from '@/lib/portal-access';
import { canAccessOrganization, getApiAuthContext, isUuid } from '@/lib/api-auth-context';

async function fetchAuthUserById(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<User | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return data.user;
}

function userBelongsToOrg(authUser: User, orgId: string): boolean {
  return String(authUser.app_metadata?.org_id ?? '') === orgId;
}

export async function GET(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!canManageUsers({ userId: user.id, orgId: callerOrgId, role, isSuperAdmin })) {
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

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: members, error: membersError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role, status')
      .eq('org_id', orgId);

    if (membersError) {
      console.error('org-members memberships error:', membersError);
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    const userIds = Array.from(new Set((members ?? []).map((member) => member.user_id)));
    if (userIds.length === 0) {
      return NextResponse.json([]);
    }

    const authUsers = await Promise.all(userIds.map((userId) => fetchAuthUserById(supabaseAdmin, userId)));
    const authUsersById = new Map(
      authUsers.filter((authUser): authUser is User => authUser != null).map((authUser) => [authUser.id, authUser]),
    );

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, first_name, last_name, is_super_admin')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('org-members profiles error:', profilesError);
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    const membersByUserId = new Map((members ?? []).map((member) => [member.user_id, member]));
    const profilesByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

    const formattedMembers = userIds
      .map((userId) => {
        const member = membersByUserId.get(userId);
        const profile = profilesByUserId.get(userId);
        const authUser = authUsersById.get(userId);

        if (!authUser || !userBelongsToOrg(authUser, orgId)) {
          return null;
        }

        const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
        const isInvited = !!authUser.invited_at && !authUser.last_sign_in_at;

        return {
          id: userId,
          email: authUser.email ?? '',
          role: member?.role ?? String(authUser.app_metadata?.role ?? ''),
          username: fullName || authUser.email || userId,
          firstName: profile?.first_name ?? '',
          lastName: profile?.last_name ?? '',
          ...(isSuperAdmin ? { isSuperAdmin: profile?.is_super_admin === true } : {}),
          status: member?.status ?? (isInvited ? 'invitado' : 'activo'),
          lastSignInAt: authUser.last_sign_in_at ?? '',
        };
      })
      .filter(Boolean);

    return NextResponse.json(formattedMembers);
  } catch (err) {
    console.error('org-members API error:', err);
    return NextResponse.json({ error: (err as Error).message || ApiErrors.UNKNOWN }, { status: 500 });
  }
}
