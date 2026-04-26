import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function listAllAuthUsers(supabaseAdmin: any) {
  const perPage = 100;
  let page = 1;
  const allUsers: any[] = [];

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const pageUsers = data?.users ?? [];
    allUsers.push(...pageUsers);

    const nextPage = data?.nextPage;
    if (!nextPage || pageUsers.length === 0) break;
    page = nextPage;
  }

  return allUsers;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orgId);
    if (!isUuid) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Query memberships first (does not require FK metadata)
    const { data: members, error: membersError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role, status')
      .eq('org_id', orgId);

    if (membersError) {
      console.error('org-members memberships error:', membersError);
      return new Response(JSON.stringify({ error: membersError.message }), { status: 500 });
    }

    let allAuthUsers: any[] = [];
    try {
      allAuthUsers = await listAllAuthUsers(supabaseAdmin);
    } catch (authUsersError: any) {
      console.error('org-members auth users error:', authUsersError);
      return new Response(JSON.stringify({ error: authUsersError.message }), { status: 500 });
    }

    const authUsersInOrg = allAuthUsers.filter((user: any) => user?.app_metadata?.org_id === orgId);
    const userIds = Array.from(
      new Set([
        ...(members ?? []).map((m: any) => m.user_id),
        ...authUsersInOrg.map((user: any) => user.id),
      ])
    );

    if (userIds.length === 0) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, first_name, last_name, is_super_admin')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('org-members profiles error:', profilesError);
      return new Response(JSON.stringify({ error: profilesError.message }), { status: 500 });
    }

    const authUsersById = new Map(allAuthUsers.map((u) => [u.id, u]));
    const membersByUserId = new Map((members ?? []).map((m: any) => [m.user_id, m]));

    const profilesByUserId = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    // Format the response
    const formattedMembers = userIds.map((userId: string) => {
      const member = membersByUserId.get(userId);
      const profile = profilesByUserId.get(userId);
      const authUser = authUsersById.get(userId);
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
      const isInvited = !!authUser?.invited_at && !authUser?.last_sign_in_at;
      const role = member?.role ?? authUser?.app_metadata?.role ?? authUser?.user_metadata?.role ?? '';
      const status = member?.status ?? (isInvited ? 'invitado' : 'activo');
      return {
        id: userId,
        email: authUser?.email ?? '',
        role,
        username: fullName || authUser?.email || userId,
        status,
        lastSignInAt: authUser?.last_sign_in_at ?? '',
      };
    });

    return new Response(JSON.stringify(formattedMembers), { status: 200 });
  } catch (err) {
    console.error('org-members API error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message || 'Unknown error' }), { status: 500 });
  }
}