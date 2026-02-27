export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';

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
  const { data: { session } } = await supabase.auth.getSession();
  if (!user) return { user: null, isSuperAdmin: false, role: '', accessToken: null as string | null };

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
    accessToken: session?.access_token ?? null,
  };
}

async function createStorageCustomer(
  organizationId: string,
  organizationName: string,
  isActive: boolean,
  accessToken: string,
) {
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error('Missing API_BASE_URL');
  }

  const res = await fetch(`${apiBaseUrl}/api/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      customerId: organizationId,
      customerName: organizationName,
      isActive,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = typeof data === 'string' ? data : data?.error ?? data?.title;
    throw new Error(message || 'No se pudo registrar el cliente en almacenamiento');
  }
}

export async function GET(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }
    if (!isSuperAdmin && role !== 'org:admin' && role !== 'org:sistema') {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
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
      return NextResponse.json({ error: error.message || 'No se pudieron cargar las empresas' }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || ApiErrors.UNKNOWN }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, accessToken } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }
    if (!isSuperAdmin) {
      return NextResponse.json({ error: ApiErrors.SUPERADMIN_CREATE_ORGS }, { status: 403 });
    }
    if (!accessToken) {
      return NextResponse.json({ error: ApiErrors.NO_AUTH_USER }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body?.name ?? '').trim();
    const code = String(body?.code ?? '').trim();
    const ruc = String(body?.ruc ?? '').trim();
    const isActive = body?.isActive === false ? false : true;

    if (!name || !code) {
      return NextResponse.json({ error: ApiErrors.MISSING_NAME_OR_CODE }, { status: 400 });
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
      const message = String(error.message ?? 'No se pudo crear el cliente');
      if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
        return NextResponse.json({ error: 'El código de cliente ya existe' }, { status: 409 });
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    try {
      await createStorageCustomer(data.id, name, isActive, accessToken);
    } catch (storageError: unknown) {
      await supabaseAdmin.from('organizations').delete().eq('id', data.id);
      const message = storageError instanceof Error
        ? storageError.message
        : 'No se pudo registrar el cliente en almacenamiento';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true, organization: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || ApiErrors.UNKNOWN }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, isSuperAdmin } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }
    if (!isSuperAdmin) {
      return NextResponse.json({ error: ApiErrors.SUPERADMIN_UPDATE_STATUS }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body?.id ?? '').trim();
    const isActive = Boolean(body?.isActive);

    if (!id) {
      return NextResponse.json({ error: 'Falta el id de la empresa' }, { status: 400 });
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
      return NextResponse.json({ error: error.message || 'No se pudo actualizar el estado de la empresa' }, { status: 500 });
    }

    return NextResponse.json({ success: true, organization: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || ApiErrors.UNKNOWN }, { status: 500 });
  }
}
