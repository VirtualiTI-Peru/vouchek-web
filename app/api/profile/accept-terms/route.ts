import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { resolveWebTermsDocument, termsVersionKey } from '@/lib/legal';
import { acceptTermsVersion } from '@/lib/legal-api';

function bearerFromRequest(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as { version?: string }));
    const doc = resolveWebTermsDocument(role, isSuperAdmin);

    const version =
      (typeof body?.version === 'string' && body.version.trim())
      || (doc ? termsVersionKey(doc) : null);

    if (!version) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const saved = await acceptTermsVersion(version, bearerFromRequest(req));
    return NextResponse.json({ success: true, version: saved.version });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
