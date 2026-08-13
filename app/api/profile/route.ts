import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { mapSupabaseError } from '@/lib/auth-errors';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { resolveWebTermsDocument, termsVersionKey } from '@/lib/legal';
import { getAcceptedTermsVersion } from '@/lib/legal-api';
import { ensureUaProfile, getUniversalAuthAdmin } from '@/lib/universal-auth-admin';

function splitFullName(fullName?: string | null): { firstName: string; lastName: string } {
  const trimmed = fullName?.trim() ?? '';
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function bearerFromRequest(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function GET(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    const uaAdmin = getUniversalAuthAdmin();
    const termsDocument = resolveWebTermsDocument(role, isSuperAdmin);
    const requiredTermsVersion = termsDocument ? termsVersionKey(termsDocument) : null;
    const accessToken = bearerFromRequest(req);

    const [{ data: profile, error }, termsAcceptedVersion] = await Promise.all([
      uaAdmin
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle(),
      requiredTermsVersion
        ? getAcceptedTermsVersion(requiredTermsVersion, accessToken)
        : Promise.resolve(null),
    ]);

    if (error) {
      return NextResponse.json({ error: mapSupabaseError(error.message) }, { status: 500 });
    }

    const { firstName, lastName } = splitFullName(profile?.full_name as string | undefined);

    return NextResponse.json({
      firstName,
      lastName,
      termsAcceptedVersion,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    const body = await req.json();
    const firstName = String(body?.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'firstName y lastName son obligatorios.' }, { status: 400 });
    }

    const uaAdmin = getUniversalAuthAdmin();
    const fullName = `${firstName} ${lastName}`.trim();

    try {
      await ensureUaProfile(uaAdmin, user.id, fullName);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ApiErrors.SAVE_PROFILE;
      return NextResponse.json({ error: mapSupabaseError(message) }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
