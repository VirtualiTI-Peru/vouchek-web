import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { sendPasswordResetEmail } from '@/lib/sendInviteEmail';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { getUniversalAuthAdmin } from '@/lib/universal-auth-admin';

function firstNameFromFullName(fullName?: string | null): string {
  const trimmed = fullName?.trim() ?? '';
  if (!trimmed) return 'Usuario';
  return trimmed.split(/\s+/)[0] || 'Usuario';
}

export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json({ error: ApiErrors.USER_EMAIL_NOT_FOUND }, { status: 400 });
    }

    const uaAdmin = getUniversalAuthAdmin();
    const recoveryBaseUrl = process.env.INVITE_BASE_URL || req.nextUrl.origin;

    const [
      { data: profile },
      { data: linkData, error: linkError },
    ] = await Promise.all([
      uaAdmin
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle(),
      uaAdmin.auth.admin.generateLink({
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

    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      changePasswordLink: setupLink,
      firstName: firstNameFromFullName(profile?.full_name as string | undefined),
      orgName: orgId || 'VouChek',
    });

    if (emailResult.error) {
      return NextResponse.json({ error: ApiErrors.PASSWORD_RESET_EMAIL }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
