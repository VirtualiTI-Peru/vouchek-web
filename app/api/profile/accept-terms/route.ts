import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import { mapSupabaseError } from '@/lib/auth-errors';
import { resolveWebTermsDocument, termsVersionKey } from '@/lib/legal';

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
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .single();

    const isSuperAdmin = profile?.is_super_admin === true;
    const role = String(user.app_metadata?.role ?? '');
    const doc = resolveWebTermsDocument(role, isSuperAdmin);

    if (!doc) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const version = termsVersionKey(doc);
    const { error } = await supabaseAdmin
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
