import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import { sendPasswordResetEmail } from '@/lib/sendInviteEmail';

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json({ error: ApiErrors.USER_EMAIL_NOT_FOUND }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const recoveryBaseUrl = process.env.INVITE_BASE_URL || req.nextUrl.origin;

    const [
      { data: profile },
      { data: orgMembership },
      { data: linkData, error: linkError },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('first_name').eq('user_id', user.id).single(),
      supabaseAdmin
        .from('organization_members')
        .select('org_id, organizations(name)')
        .eq('user_id', user.id)
        .limit(1)
        .single(),
      supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
        options: {
          redirectTo: `${recoveryBaseUrl}/set-password`,
        },
      }),
    ]);

    if (linkError || !linkData) {
      return NextResponse.json(
        { error: linkError?.message || ApiErrors.PASSWORD_RESET_LINK },
        { status: 500 }
      );
    }

    const hashedToken = linkData?.properties?.hashed_token;
    const setupLink = hashedToken
      ? `${recoveryBaseUrl}/set-password?type=recovery&token_hash=${encodeURIComponent(hashedToken)}`
      : linkData?.properties?.action_link;

    if (!setupLink) {
      return NextResponse.json({ error: ApiErrors.PASSWORD_RESET_LINK }, { status: 500 });
    }

    const orgName =
      (orgMembership as any)?.organizations?.name ??
      String(user.app_metadata?.org_id ?? 'VouChek');

    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      changePasswordLink: setupLink,
      firstName: profile?.first_name ?? 'Usuario',
      orgName,
    });

    if (emailResult.error) {
      return NextResponse.json({ error: ApiErrors.PASSWORD_RESET_EMAIL }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || ApiErrors.UNKNOWN }, { status: 500 });
  }
}
