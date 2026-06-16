import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import { mapSupabaseError } from '@/lib/auth-errors';
import { sendWelcomeEmail } from '@/lib/sendInviteEmail';
import { assertCanAddOrganizationUser } from '@/lib/organization-limits';
import { organizationLimitErrorResponse } from '@/lib/organization-limit-response';

type BulkUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  role?: string;
};

type BulkRowResult = {
  row: number;
  email: string;
  role?: string;
  success: boolean;
  emailSent: boolean;
  generatedPassword?: string;
  error?: string;
};

const ALLOWED_ROLES = new Set(['org:transportista', 'org:verificador', 'org:sistema', 'org:admin']);
const ROLE_ALIASES: Record<string, string> = {
  'org:transportista': 'org:transportista',
  transportista: 'org:transportista',
  'org:sistema': 'org:sistema',
  sistema: 'org:sistema',
  'administrador del sistema': 'org:sistema',
  'admin del sistema': 'org:sistema',
  'org:verificador': 'org:verificador',
  verificador: 'org:verificador',
  'org:admin': 'org:admin',
  admin: 'org:admin',
  administrador: 'org:admin',
};

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateSimplePassword(length = 10) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * PASSWORD_ALPHABET.length);
    out += PASSWORD_ALPHABET[idx];
  }
  return out;
}

function normalizeRoleInput(input: string) {
  const key = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return ROLE_ALIASES[key] ?? '';
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

    const body = await req.json();
    const orgId = String(body?.orgId ?? '').trim();
    const role = normalizeRoleInput(String(body?.role ?? 'org:transportista'));
    const autoGeneratePassword = body?.autoGeneratePassword !== false;
    const users = Array.isArray(body?.users) ? (body.users as BulkUserInput[]) : [];

    if (!orgId || users.length === 0) {
      return NextResponse.json({ error: ApiErrors.MISSING_ORG_OR_USERS }, { status: 400 });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 });
    }

    if (users.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 filas por carga.' }, { status: 400 });
    }

    if (!isSuperAdmin && callerOrgId !== orgId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const prospectiveEmails = new Set<string>();
    let prospectiveCreates = 0;
    for (const item of users) {
      const email = String(item?.email ?? '').trim().toLowerCase();
      const firstName = String(item?.firstName ?? '').trim();
      const lastName = String(item?.lastName ?? '').trim();
      if (!email || !firstName || !lastName || prospectiveEmails.has(email)) continue;
      prospectiveEmails.add(email);
      prospectiveCreates += 1;
    }

    if (prospectiveCreates > 0) {
      try {
        await assertCanAddOrganizationUser(supabaseAdmin, orgId, prospectiveCreates);
      } catch (limitError) {
        const response = organizationLimitErrorResponse(limitError);
        if (response) return response;
        throw limitError;
      }
    }

    const recoveryBaseUrl = process.env.INVITE_BASE_URL || req.nextUrl.origin;
    const loginLink = `${recoveryBaseUrl}/sign-in`;

    const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', orgId).single();
    const orgName = org?.name ?? orgId;

    const seenEmails = new Set<string>();
    const results: BulkRowResult[] = [];

    for (let i = 0; i < users.length; i += 1) {
      const rowNumber = i + 1;
      const item = users[i] ?? ({} as BulkUserInput);

      const email = String(item.email ?? '').trim().toLowerCase();
      const firstName = String(item.firstName ?? '').trim();
      const lastName = String(item.lastName ?? '').trim();

      if (!email || !firstName || !lastName) {
        results.push({
          row: rowNumber,
          email,
          success: false,
          emailSent: false,
          error: 'Faltan campos requeridos (email, firstName, lastName).',
        });
        continue;
      }

      if (seenEmails.has(email)) {
        results.push({
          row: rowNumber,
          email,
          success: false,
          emailSent: false,
          error: 'Correo duplicado dentro del CSV.',
        });
        continue;
      }
      seenEmails.add(email);

      const providedPassword = String(item.password ?? '').trim();
      const generatedPassword = autoGeneratePassword && !providedPassword ? generateSimplePassword() : '';
      const password = providedPassword || generatedPassword;
      const rowRole = normalizeRoleInput(String(item.role ?? ''));
      const assignedRole = rowRole || role;

      if (!ALLOWED_ROLES.has(assignedRole)) {
        results.push({
          row: rowNumber,
          email,
          role: assignedRole,
          success: false,
          emailSent: false,
          error: 'Rol inválido.',
        });
        continue;
      }

      if (!password || password.length < 6) {
        results.push({
          row: rowNumber,
          email,
          success: false,
          emailSent: false,
          error: 'Contraseña inválida (mínimo 6 caracteres).',
        });
        continue;
      }

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { org_id: orgId, role: assignedRole },
      });

      if (createError || !created?.user) {
        results.push({
          row: rowNumber,
          email,
          success: false,
          emailSent: false,
          error: mapSupabaseError(createError?.message ?? '') || 'No se pudo crear el usuario.',
        });
        continue;
      }

      const userId = created.user.id;

      const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
        {
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          is_super_admin: false,
        },
        { onConflict: 'user_id' }
      );

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        results.push({
          row: rowNumber,
          email,
          success: false,
          emailSent: false,
          error: mapSupabaseError(profileError.message) || 'No se pudo guardar el perfil.',
        });
        continue;
      }

      const { error: membershipError } = await supabaseAdmin.from('organization_members').upsert(
        {
          org_id: orgId,
          user_id: userId,
          role: assignedRole,
          status: 'active',
        },
        { onConflict: 'org_id,user_id' }
      );

      if (membershipError) {
        console.warn('organization_members upsert skipped during bulk-create:', membershipError);
      }

      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${recoveryBaseUrl}/set-password`,
        },
      });

      const hashedToken = linkData?.properties?.hashed_token;
      const setupLink = hashedToken
        ? `${recoveryBaseUrl}/set-password?type=recovery&token_hash=${encodeURIComponent(hashedToken)}`
        : linkData?.properties?.action_link;

      const emailResult = await sendWelcomeEmail({
        to: email,
        setupLink,
        loginLink,
        orgName,
        firstName,
        temporaryPassword: password,
        role: assignedRole,
      });

      if (emailResult.error) {
        results.push({
          row: rowNumber,
          email,
          role: assignedRole,
          success: true,
          emailSent: false,
          generatedPassword: generatedPassword || undefined,
          error: 'Usuario creado, pero falló el correo de bienvenida.',
        });
        continue;
      }

      results.push({
        row: rowNumber,
        email,
        role: assignedRole,
        success: true,
        emailSent: true,
        generatedPassword: generatedPassword || undefined,
      });
    }

    const created = results.filter((item) => item.success).length;
    const failed = results.length - created;
    const emailSent = results.filter((item) => item.emailSent).length;
    const emailFailed = created - emailSent;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        created,
        failed,
        emailSent,
        emailFailed,
      },
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || ApiErrors.BULK_CREATE_USERS }, { status: 500 });
  }
}
