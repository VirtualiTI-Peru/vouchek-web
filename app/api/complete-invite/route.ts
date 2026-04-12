import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail } from '@/lib/sendInviteEmail';
import { createHash } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { token, firstName, lastName, password } = await req.json();
    if (!token || !firstName || !lastName || !password) {
      return NextResponse.json({ error: 'Missing token, firstName, lastName or password' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres.' }, { status: 400 });
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
      return NextResponse.json({ error: invitationError.message || 'Failed to validate invitation' }, { status: 500 });
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
      if (createError?.message?.toLowerCase().includes('already registered')) {
        return NextResponse.json({ error: 'El usuario ya existe. Solicita acceso a un administrador.' }, { status: 409 });
      }
      return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 500 });
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
      return NextResponse.json({ error: profileError.message || 'Failed to save profile' }, { status: 500 });
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
      return NextResponse.json({ error: invitationUpdateError.message || 'Failed to finalize invitation' }, { status: 500 });
    }

    const orgId = invitation.org_id;
    let orgName = 'tu organización';
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
    return NextResponse.json({ error: error?.message || 'Failed to complete invite' }, { status: 500 });
  }
}
