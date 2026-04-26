import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

async function getAuthContext(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isSuperAdmin: false, role: '', orgId: '' };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_super_admin')
    .eq('user_id', user.id)
    .single();

  return {
    user,
    isSuperAdmin: profile?.is_super_admin === true,
    role: String(user.app_metadata?.role ?? ''),
    orgId: String(user.app_metadata?.org_id ?? ''),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!isSuperAdmin && role !== 'org:admin' && role !== 'org:sistema') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const userId = String(body?.userId ?? '').trim();
    const orgId = String(body?.orgId ?? '').trim();

    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Missing userId or orgId' }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'No puedes eliminar tu propio usuario.' }, { status: 400 });
    }

    if (!isSuperAdmin && callerOrgId !== orgId) {
      return NextResponse.json({ error: 'Forbidden for this organization' }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [
      { data: targetUserData, error: userError },
      { data: targetProfile, error: profileError },
    ] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(userId),
      supabaseAdmin.from('profiles').select('is_super_admin').eq('user_id', userId).maybeSingle(),
    ]);

    if (userError || !targetUserData?.user) {
      return NextResponse.json({ error: userError?.message || 'User not found' }, { status: 404 });
    }

    if (profileError) {
      return NextResponse.json({ error: profileError.message || 'Failed to validate user profile' }, { status: 500 });
    }

    if (targetProfile?.is_super_admin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Solo un superadmin puede eliminar otro superadmin.' }, { status: 403 });
    }

    const targetUser = targetUserData.user;
    const targetOrgId = String(targetUser.app_metadata?.org_id ?? '');

    if (targetOrgId && targetOrgId !== orgId) {
      return NextResponse.json({ error: 'User does not belong to the selected organization' }, { status: 400 });
    }

    // Remove dependent app rows before deleting auth user to avoid FK failures.
    const cleanupResults = await Promise.allSettled([
      supabaseAdmin.from('organization_members').delete().eq('user_id', userId),
      supabaseAdmin.from('profiles').delete().eq('user_id', userId),
    ]);

    for (const result of cleanupResults) {
      if (result.status === 'rejected') {
        return NextResponse.json({ error: 'Failed to cleanup user records' }, { status: 500 });
      }

      if (result.value.error) {
        return NextResponse.json({ error: result.value.error.message || 'Failed to cleanup user records' }, { status: 500 });
      }
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (!deleteAuthError) {
      return NextResponse.json({ success: true, softDeleted: false });
    }

    // Fallback for schemas where hard-delete is blocked by remaining relations.
    const { error: softDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId, true);
    if (softDeleteError) {
      return NextResponse.json(
        { error: softDeleteError.message || deleteAuthError.message || 'Failed to delete auth user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, softDeleted: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}