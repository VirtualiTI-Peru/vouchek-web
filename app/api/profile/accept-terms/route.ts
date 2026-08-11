import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { mapSupabaseError } from '@/lib/auth-errors';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';
import { resolveWebTermsDocument, termsVersionKey } from '@/lib/legal';

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    const dataAdmin = getVouchekDataSupabaseAdmin();
    const body = await req.json().catch(() => ({} as { version?: string }));
    const doc = resolveWebTermsDocument(role, isSuperAdmin);

    const version =
      (typeof body?.version === 'string' && body.version.trim())
      || (doc ? termsVersionKey(doc) : null);

    if (!version) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const { error } = await dataAdmin
      .from('profiles')
      .update({
        terms_accepted_version: version,
        terms_accepted_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: mapSupabaseError(error.message) }, { status: 500 });
    }

    return NextResponse.json({ success: true, version });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
