import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendPasswordResetEmail } from '@/lib/sendInviteEmail';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';
import { getUniversalAuthAdmin } from '@/lib/universal-auth-admin';

const GENERIC_SUCCESS_MESSAGE =
  'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';

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
    const dataAdmin = getVouchekDataSupabaseAdmin();

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
    const [{ data: profile }, { data: orgMembership }] = await Promise.all([
      dataAdmin.from('profiles').select('first_name').eq('user_id', userId).maybeSingle(),
      dataAdmin
        .from('organization_members')
        .select('org_id, organizations(name)')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
    ]);

    const orgRelation = orgMembership?.organizations as { name?: string } | { name?: string }[] | null | undefined;
    const orgName =
      (Array.isArray(orgRelation) ? orgRelation[0]?.name : orgRelation?.name) ?? 'Vouchek';

    await sendPasswordResetEmail({
      to: linkData.user.email,
      changePasswordLink: setupLink,
      orgName,
      firstName: profile?.first_name ?? 'Usuario',
    });

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
  } catch (error: unknown) {
    console.error('forgot-password error:', error);
    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
  }
}
