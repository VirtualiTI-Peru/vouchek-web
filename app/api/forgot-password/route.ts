import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requestVouchekForgotPassword } from '@/lib/universal-auth-api';

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

    const result = await requestVouchekForgotPassword(email);
    if (!result.ok) {
      // Keep login UX non-enumerating unless the request itself was invalid.
      if (result.status === 400) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      console.error('forgot-password UA error:', result.status, result.error);
    }

    return NextResponse.json({
      message: result.ok ? result.message : GENERIC_SUCCESS_MESSAGE,
    });
  } catch (error: unknown) {
    console.error('forgot-password error:', error);
    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
  }
}
