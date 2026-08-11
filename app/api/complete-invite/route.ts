import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { isSupabaseDuplicateUserMessage, mapSupabaseError } from '@/lib/auth-errors';
import { sendWelcomeEmail } from '@/lib/sendInviteEmail';
import { assertCanAddOrganizationUser } from '@/lib/organization-limits';
import { organizationLimitErrorResponse } from '@/lib/organization-limit-response';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';
import {
  assignTenantUser,
  ensureUaProfile,
  getUniversalAuthAdmin,
  normalizeCreateRole,
} from '@/lib/universal-auth-admin';
import { createHash } from 'crypto';

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, 'complete-invite', 10, 15 * 60 * 1000);
  if (rateLimited) return rateLimited;

  try {
    const { token, firstName, lastName, password } = await req.json();
    if (!token || !firstName || !lastName || !password) {
      return NextResponse.json({ error: ApiErrors.MISSING_INVITE_FIELDS }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const dataAdmin = getVouchekDataSupabaseAdmin();
    const uaAdmin = getUniversalAuthAdmin();

    const tokenHash = createHash('sha256').update(String(token)).digest('hex');
    const { data: invitation, error: invitationError } = await dataAdmin
      .from('invitations')
      .select('id, org_id, email, role, expires_at, accepted_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (invitationError) {
      return NextResponse.json({ error: mapSupabaseError(invitationError.message) || ApiErrors.VALIDATE_INVITATION }, { status: 500 });
    }
    if (!invitation) {
      return NextResponse.json({ error: 'Invitacion invalida.' }, { status: 404 });
    }
    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'Esta invitacion ya fue utilizada.' }, { status: 410 });
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Esta invitacion ya expiro.' }, { status: 410 });
    }

    try {
      await assertCanAddOrganizationUser(dataAdmin, invitation.org_id, 1);
    } catch (limitError) {
      const response = organizationLimitErrorResponse(limitError);
      if (response) return response;
      throw limitError;
    }

    const normalizedRole = normalizeCreateRole(invitation.role);

    const { data: created, error: createError } = await uaAdmin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
    });

    if (createError || !created?.user) {
      if (createError && isSupabaseDuplicateUserMessage(createError.message)) {
        return NextResponse.json({ error: 'No se pudo completar el registro. Solicita acceso a un administrador.' }, { status: 409 });
      }
      return NextResponse.json({ error: mapSupabaseError(createError?.message ?? '') || ApiErrors.CREATE_USER }, { status: 500 });
    }

    const user = created.user;
    const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();

    try {
      const profileId = await ensureUaProfile(uaAdmin, user.id, fullName);
      await assignTenantUser({
        admin: uaAdmin,
        profileId,
        tenantId: invitation.org_id,
        roleSlug: normalizedRole,
      });
    } catch (assignError: unknown) {
      await uaAdmin.auth.admin.deleteUser(user.id);
      const message = assignError instanceof Error ? assignError.message : ApiErrors.CREATE_USER;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { error: profileError } = await dataAdmin
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          is_super_admin: false,
        },
        { onConflict: 'user_id' }
      );
    if (profileError) {
      await uaAdmin.auth.admin.deleteUser(user.id);
      return NextResponse.json({ error: mapSupabaseError(profileError.message) || ApiErrors.SAVE_PROFILE }, { status: 500 });
    }

    const { error: membershipError } = await dataAdmin
      .from('organization_members')
      .upsert(
        {
          org_id: invitation.org_id,
          user_id: user.id,
          role: normalizedRole,
          status: 'active',
        },
        { onConflict: 'org_id,user_id' }
      );
    if (membershipError) {
      console.warn('organization_members upsert skipped during invite completion:', membershipError);
    }

    const { error: invitationUpdateError } = await dataAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);
    if (invitationUpdateError) {
      return NextResponse.json({ error: mapSupabaseError(invitationUpdateError.message) || ApiErrors.FINALIZE_INVITATION }, { status: 500 });
    }

    const orgId = invitation.org_id;
    let orgName = 'tu empresa';
    if (orgId) {
      const { data: org } = await dataAdmin
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();
      orgName = org?.name ?? orgName;
    }

    if (user.email) {
      const appUrl = req.nextUrl.origin;
      const emailResult = await sendWelcomeEmail({
        to: user.email,
        loginLink: `${appUrl}/sign-in`,
        orgName,
        firstName,
      });
      if (emailResult.error) {
        console.error('Resend error (welcome):', emailResult.error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || ApiErrors.COMPLETE_INVITE }, { status: 500 });
  }
}
