import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { isSupabaseDuplicateUserMessage, mapSupabaseError } from '@/lib/auth-errors';
import { sendWelcomeEmail } from '@/lib/sendInviteEmail';
import { assertCanAddOrganizationUser } from '@/lib/organization-limits';
import { organizationLimitErrorResponse } from '@/lib/organization-limit-response';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { isVouchekRole, VOUCHEK_ROLES } from '@/lib/roles';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';
import {
  assignTenantUser,
  ensureUaProfile,
  getUniversalAuthAdmin,
  normalizeCreateRole,
} from '@/lib/universal-auth-admin';

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateSimplePassword(length = 10) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * PASSWORD_ALPHABET.length);
    out += PASSWORD_ALPHABET[idx];
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role: callerRole, orgId: callerOrgId } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!isSuperAdmin && !isVouchekRole(callerRole, VOUCHEK_ROLES.ADMIN, VOUCHEK_ROLES.SISTEMA)) {
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
    const normalizedRole = normalizeCreateRole(role);
    const assignedPassword = String(password ?? '').trim() || generateSimplePassword();

    if (assignedPassword.length < 6) {
      return NextResponse.json({ error: ApiErrors.PASSWORD_TOO_SHORT }, { status: 400 });
    }

    const dataAdmin = getVouchekDataSupabaseAdmin();
    const uaAdmin = getUniversalAuthAdmin();

    try {
      await assertCanAddOrganizationUser(dataAdmin, String(orgId), 1);
    } catch (limitError) {
      const response = organizationLimitErrorResponse(limitError);
      if (response) return response;
      throw limitError;
    }

    const { data, error } = await uaAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: assignedPassword,
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
    const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();

    try {
      const profileId = await ensureUaProfile(uaAdmin, newUserId, fullName);
      await assignTenantUser({
        admin: uaAdmin,
        profileId,
        tenantId: String(orgId),
        roleSlug: normalizedRole,
      });
    } catch (assignError: unknown) {
      await uaAdmin.auth.admin.deleteUser(newUserId);
      const message = assignError instanceof Error ? assignError.message : ApiErrors.CREATE_USER;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { error: profileError } = await dataAdmin.from('profiles').upsert({
      user_id: newUserId,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      is_super_admin: false,
    }, { onConflict: 'user_id' });

    if (profileError) {
      console.warn('VouChek data profiles upsert failed:', profileError.message);
    }

    const { error: membershipError } = await dataAdmin.from('organization_members').insert({
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

    const { data: linkData, error: linkError } = await uaAdmin.auth.admin.generateLink({
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

    const { data: org } = await dataAdmin.from('organizations').select('name').eq('id', orgId).single();
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
        { status: 200 },
      );
    }

    return NextResponse.json({ success: true, user: data.user, emailSent: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ApiErrors.CREATE_USER;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
