import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import { sendPasswordResetEmail } from '@/lib/sendInviteEmail';

const GENERIC_SUCCESS_MESSAGE =
  'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildSetPasswordUrl(baseUrl: string, source?: string): string {
  if (source === 'mobile') {
    return `${baseUrl}/set-password?source=mobile`;
  }
  return `${baseUrl}/set-password`;
}

function appendSourceToRecoveryLink(link: string, source?: string): string {
  if (source !== 'mobile') {
    return link;
  }

  const separator = link.includes('?') ? '&' : '?';
  return `${link}${separator}source=mobile`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const normalizedEmail = String(body?.email ?? '').trim().toLowerCase();
    const source = body?.source === 'mobile' ? 'mobile' : undefined;

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: ApiErrors.INVALID_EMAIL }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const recoveryBaseUrl = process.env.INVITE_BASE_URL || req.nextUrl.origin;
    const setPasswordUrl = buildSetPasswordUrl(recoveryBaseUrl, source);

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: setPasswordUrl,
      },
    });

    const userId = linkData?.user?.id;
    if (linkError || !userId) {
      return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
    }

    const hashedToken = linkData.properties?.hashed_token;
    const setupLink = appendSourceToRecoveryLink(
      hashedToken
        ? `${recoveryBaseUrl}/set-password?type=recovery&token_hash=${encodeURIComponent(hashedToken)}`
        : (linkData.properties?.action_link ?? ''),
      source,
    );

    if (!setupLink) {
      return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
    }

    const [{ data: profile }, { data: orgMembership }] = await Promise.all([
      supabaseAdmin.from('profiles').select('first_name').eq('user_id', userId).single(),
      supabaseAdmin
        .from('organization_members')
        .select('org_id, organizations(name)')
        .eq('user_id', userId)
        .limit(1)
        .single(),
    ]);

    const orgName =
      (orgMembership as { organizations?: { name?: string } } | null)?.organizations?.name ??
      String(linkData.user?.app_metadata?.org_id ?? 'VouChek');

    await sendPasswordResetEmail({
      to: normalizedEmail,
      changePasswordLink: setupLink,
      firstName: profile?.first_name ?? 'Usuario',
      orgName,
    });

    return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
  } catch {
    return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
  }
}
