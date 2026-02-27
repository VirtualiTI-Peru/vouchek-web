import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';

const ALLOWED_ROLES = new Set(['org:transportista', 'org:verificador', 'org:sistema']);

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
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isSuperAdmin: false, role: '', orgId: '' };
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

  return {
    user,
    isSuperAdmin: profile?.is_super_admin === true,
    role: String(user.app_metadata?.role ?? ''),
    orgId: String(user.app_metadata?.org_id ?? ''),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role: callerRole, orgId: callerOrgId } = await getAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!isSuperAdmin && callerRole !== 'org:admin' && callerRole !== 'org:sistema') {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const body = await req.json();
    const userId = String(body?.userId ?? '').trim();
    const orgId = String(body?.orgId ?? '').trim();
    const firstName = String(body?.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();
    const role = String(body?.role ?? '').trim();
    const requestedIsSuperAdmin = body?.isSuperAdmin === true;

    if (!userId || !orgId || !firstName || !lastName || !role) {
      return NextResponse.json({ error: ApiErrors.MISSING_REQUIRED_FIELDS }, { status: 400 });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: 'Rol no válido.' }, { status: 400 });
    }

    if (!isSuperAdmin && callerOrgId !== orgId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const [
      { data: targetUserData, error: userError },
      { data: targetProfile, error: profileError },
    ] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(userId),
      supabaseAdmin.from('profiles').select('is_super_admin').eq('user_id', userId).maybeSingle(),
    ]);

    if (userError || !targetUserData?.user) {
      return NextResponse.json({ error: userError?.message || ApiErrors.USER_NOT_FOUND }, { status: 404 });
    }

    if (profileError) {
      return NextResponse.json({ error: profileError.message || ApiErrors.VALIDATE_USER_PROFILE }, { status: 500 });
    }

    if (targetProfile?.is_super_admin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Solo un superadmin puede editar otro superadmin.' }, { status: 403 });
    }

    if (requestedIsSuperAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Solo un superadmin puede asignar el rol de superadmin.' }, { status: 403 });
    }

    const targetUser = targetUserData.user;
    const targetOrgId = String(targetUser.app_metadata?.org_id ?? '');

    if (targetOrgId && targetOrgId !== orgId) {
      return NextResponse.json({ error: ApiErrors.USER_NOT_IN_ORG }, { status: 400 });
    }

    const profileUpdate = {
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      is_super_admin: isSuperAdmin
        ? requestedIsSuperAdmin
        : targetProfile?.is_super_admin === true,
    };

    const { error: profileSaveError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileUpdate, { onConflict: 'user_id' });

    if (profileSaveError) {
      return NextResponse.json({ error: profileSaveError.message || ApiErrors.SAVE_PROFILE }, { status: 500 });
    }

    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      const { error: membershipError } = await supabaseAdmin
        .from('organization_members')
        .update({ role })
        .eq('org_id', orgId)
        .eq('user_id', userId);

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message || ApiErrors.SAVE_PROFILE }, { status: 500 });
      }
    } else {
      const { error: membershipError } = await supabaseAdmin.from('organization_members').insert({
        org_id: orgId,
        user_id: userId,
        role,
        status: 'active',
      });

      if (membershipError) {
        console.warn('organization_members insert skipped during update-user:', membershipError);
      }
    }

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...targetUser.app_metadata,
        org_id: targetOrgId || orgId,
        role,
      },
    });

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message || ApiErrors.SAVE_PROFILE }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
