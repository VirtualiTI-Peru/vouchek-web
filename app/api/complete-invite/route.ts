import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import { isSupabaseDuplicateUserMessage, mapSupabaseError } from '@/lib/auth-errors';
import { sendWelcomeEmail } from '@/lib/sendInviteEmail';
import { createHash } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { token, firstName, lastName, password } = await req.json();
    if (!token || !firstName || !lastName || !password) {
      return NextResponse.json({ error: ApiErrors.MISSING_INVITE_FIELDS }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tokenHash = createHash('sha256').update(String(token)).digest('hex');
    const { data: invitation, error: invitationError } = await supabaseAdmin
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

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      app_metadata: {
        org_id: invitation.org_id,
        role: invitation.role,
      },
    });

    if (createError || !created?.user) {
      if (createError && isSupabaseDuplicateUserMessage(createError.message)) {
        return NextResponse.json({ error: 'El usuario ya existe. Solicita acceso a un administrador.' }, { status: 409 });
      }
      return NextResponse.json({ error: mapSupabaseError(createError?.message ?? '') || ApiErrors.CREATE_USER }, { status: 500 });
    }

    const user = created.user;

    const { error: profileError } = await supabaseAdmin
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
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return NextResponse.json({ error: mapSupabaseError(profileError.message) || ApiErrors.SAVE_PROFILE }, { status: 500 });
    }

    const { error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .upsert(
        {
          org_id: invitation.org_id,
          user_id: user.id,
          role: invitation.role,
          status: 'active',
        },
        { onConflict: 'org_id,user_id' }
      );
    if (membershipError) {
      console.warn('organization_members upsert skipped during invite completion:', membershipError);
    }

    const { error: invitationUpdateError } = await supabaseAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);
    if (invitationUpdateError) {
      return NextResponse.json({ error: mapSupabaseError(invitationUpdateError.message) || ApiErrors.FINALIZE_INVITATION }, { status: 500 });
    }

    const orgId = invitation.org_id;
    let orgName = 'tu empresa';
    if (orgId) {
      const { data: org } = await supabaseAdmin
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
