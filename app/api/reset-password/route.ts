import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail } from '@/lib/sendInviteEmail';

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

    if (!isSuperAdmin && callerOrgId !== orgId) {
      return NextResponse.json({ error: 'Forbidden for this organization' }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: targetUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !targetUserData?.user) {
      return NextResponse.json({ error: userError?.message || 'User not found' }, { status: 404 });
    }

    const targetUser = targetUserData.user;
    const targetOrgId = String(targetUser.app_metadata?.org_id ?? '');

    if (targetOrgId && targetOrgId !== orgId) {
      return NextResponse.json({ error: 'User does not belong to the selected organization' }, { status: 400 });
    }

    if (!targetUser.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const [
      { data: org },
      { data: profile },
      { data: linkData, error: linkError },
    ] = await Promise.all([
      supabaseAdmin.from('organizations').select('name').eq('id', orgId).single(),
      supabaseAdmin.from('profiles').select('first_name').eq('user_id', userId).single(),
      supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetUser.email,
        options: {
          redirectTo: `${req.nextUrl.origin}/set-password`,
        },
      }),
    ]);

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: linkError?.message || 'Failed to generate password setup link' }, { status: 500 });
    }

    const emailResult = await sendWelcomeEmail({
      to: targetUser.email,
      setupLink: linkData.properties.action_link,
      orgName: org?.name ?? orgId,
      firstName: profile?.first_name ?? 'Usuario',
    });

    if (emailResult.error) {
      return NextResponse.json({ error: 'Failed to send password setup email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}