export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

async function getAuthContext(req: NextRequest) {
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
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, isSuperAdmin: false, role: '' };

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_super_admin')
    .eq('user_id', user.id)
    .single();

  return {
    user,
    isSuperAdmin: profile?.is_super_admin === true,
    role: String(user.app_metadata?.role ?? ''),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!isSuperAdmin && role !== 'org:admin' && role !== 'org:sistema') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, code, ruc, is_active, created_at')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to fetch organizations' }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Only superadmin can create organizations' }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body?.name ?? '').trim();
    const code = String(body?.code ?? '').trim();
    const ruc = String(body?.ruc ?? '').trim();
    const isActive = body?.isActive === false ? false : true;

    if (!name || !code) {
      return NextResponse.json({ error: 'Missing name or code' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        code,
        ruc: ruc || null,
        is_active: isActive,
      })
      .select('id, name, code, ruc, is_active, created_at')
      .single();

    if (error) {
      const message = String(error.message ?? 'Failed to create organization');
      if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
        return NextResponse.json({ error: 'Organization code already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true, organization: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, isSuperAdmin } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Only superadmin can update status' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body?.id ?? '').trim();
    const isActive = Boolean(body?.isActive);

    if (!id) {
      return NextResponse.json({ error: 'Missing organization id' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update({ is_active: isActive })
      .eq('id', id)
      .select('id, name, code, ruc, is_active, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to update organization status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, organization: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
