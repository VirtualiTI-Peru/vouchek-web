import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendPasswordResetEmail } from '@/lib/sendInviteEmail';
import { getUniversalAuthAdmin } from '@/lib/universal-auth-admin';

const GENERIC_SUCCESS_MESSAGE =
  'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';

function firstNameFromFullName(fullName?: string | null): string {
  const trimmed = fullName?.trim() ?? '';
  if (!trimmed) return 'Usuario';
  return trimmed.split(/\s+/)[0] || 'Usuario';
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, 'forgot-password', 5, 15 * 60 * 1000);
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: ApiErrors.INVALID_EMAIL }, { status: 400 });
    }

    const uaAdmin = getUniversalAuthAdmin();

    const { data: linkData, error: linkError } = await uaAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.INVITE_BASE_URL || req.nextUrl.origin}/set-password`,
      },
    });

    if (linkError || !linkData?.user?.email) {
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
    }

    const hashedToken = linkData.properties?.hashed_token;
    const recoveryBaseUrl = process.env.INVITE_BASE_URL || req.nextUrl.origin;
    const setupLink = hashedToken
      ? `${recoveryBaseUrl}/set-password?type=recovery&token_hash=${encodeURIComponent(hashedToken)}`
      : linkData.properties?.action_link;

    if (!setupLink) {
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
    }

    const userId = linkData.user.id;
    const { data: profile } = await uaAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .maybeSingle();

    await sendPasswordResetEmail({
      to: linkData.user.email,
      changePasswordLink: setupLink,
      orgName: 'Vouchek',
      firstName: firstNameFromFullName(profile?.full_name as string | undefined),
    });

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
  } catch (error: unknown) {
    console.error('forgot-password error:', error);
    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
  }
}
