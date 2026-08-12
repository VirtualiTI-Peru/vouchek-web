import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { mapSupabaseError } from '@/lib/auth-errors';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { resolveWebTermsDocument, termsVersionKey } from '@/lib/legal';
import { getAcceptedTermsVersion } from '@/lib/legal-api';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';

export async function GET(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    const dataAdmin = getVouchekDataSupabaseAdmin();
    const termsDocument = resolveWebTermsDocument(role, isSuperAdmin);
    const requiredTermsVersion = termsDocument ? termsVersionKey(termsDocument) : null;

    const [{ data: profile, error }, termsAcceptedVersion] = await Promise.all([
      dataAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle(),
      requiredTermsVersion
        ? getAcceptedTermsVersion(requiredTermsVersion)
        : Promise.resolve(null),
    ]);

    if (error) {
      return NextResponse.json({ error: mapSupabaseError(error.message) }, { status: 500 });
    }

    return NextResponse.json({
      firstName: profile?.first_name ?? '',
      lastName: profile?.last_name ?? '',
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

    const dataAdmin = getVouchekDataSupabaseAdmin();

    const { error } = await dataAdmin
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName })
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: mapSupabaseError(error.message) }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
