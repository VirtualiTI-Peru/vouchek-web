import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import { isSupabaseDuplicateUserMessage, mapSupabaseError } from '@/lib/auth-errors';
import { sendWelcomeEmail } from '@/lib/sendInviteEmail';

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateSimplePassword(length = 10) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * PASSWORD_ALPHABET.length);
    out += PASSWORD_ALPHABET[idx];
  }
  return out;
}

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isSuperAdmin: false, role: '', orgId: '' };
  }

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

    const { email, firstName, lastName, orgId, role, password } = await req.json();
    if (!email || !orgId || !firstName || !lastName) {
      return NextResponse.json({ error: ApiErrors.MISSING_REQUIRED_FIELDS }, { status: 400 });
    }

    if (!isSuperAdmin && String(orgId) !== callerOrgId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedFirstName = String(firstName).trim();
    const normalizedLastName = String(lastName).trim();
    const normalizedRole = String(role ?? 'org:transportista');
    const assignedPassword = String(password ?? '').trim() || generateSimplePassword();

    if (assignedPassword.length < 6) {
      return NextResponse.json({ error: ApiErrors.PASSWORD_TOO_SHORT }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: assignedPassword,
      app_metadata: { org_id: orgId, role: normalizedRole },
      email_confirm: true,
    });

    if (error) {
      const alreadyRegistered = isSupabaseDuplicateUserMessage(error.message);
      return NextResponse.json(
        { error: mapSupabaseError(error.message) || ApiErrors.CREATE_USER },
        { status: alreadyRegistered ? 409 : 500 },
      );
    }

    const newUserId = data.user.id;

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      user_id: newUserId,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      is_super_admin: false,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: profileError.message ? mapSupabaseError(profileError.message) : ApiErrors.CREATE_PROFILE }, { status: 500 });
    }

    const { error: membershipError } = await supabaseAdmin.from('organization_members').insert({
      org_id: orgId,
      user_id: newUserId,
      role: normalizedRole,
      status: 'active',
    });
    if (membershipError) {
      console.warn('organization_members insert skipped during create-user:', membershipError);
    }

    const recoveryBaseUrl = process.env.INVITE_BASE_URL || req.nextUrl.origin;
    const loginLink = `${recoveryBaseUrl}/sign-in`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: `${recoveryBaseUrl}/set-password`,
      },
    });

    const hashedToken = linkData?.properties?.hashed_token;
    const setupLink = hashedToken
      ? `${recoveryBaseUrl}/set-password?type=recovery&token_hash=${encodeURIComponent(hashedToken)}`
      : linkData?.properties?.action_link;

    const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', orgId).single();
    const orgName = org?.name ?? orgId;

    const welcomeResult = await sendWelcomeEmail({
      to: normalizedEmail,
      setupLink: !linkError ? setupLink : undefined,
      loginLink,
      orgName,
      firstName: normalizedFirstName,
      temporaryPassword: assignedPassword,
      role: normalizedRole,
    });

    if (welcomeResult.error) {
      console.error('Resend error:', welcomeResult.error);
      return NextResponse.json(
        {
          success: true,
          user: data.user,
          emailSent: false,
          emailError: 'Usuario creado, pero falló el envío del correo de bienvenida.',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, user: data.user, emailSent: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || ApiErrors.CREATE_USER }, { status: 500 });
  }
}
