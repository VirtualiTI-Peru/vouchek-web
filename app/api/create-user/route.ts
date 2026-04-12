import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/sendInviteEmail";

export async function POST(req: NextRequest) {
  try {
    const { email, firstName, lastName, orgId, role } = await req.json();
    if (!email || !orgId || !firstName || !lastName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create auth user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      app_metadata: { org_id: orgId, role: role ?? 'org:transportista' },
      email_confirm: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
    }

    const newUserId = data.user.id;

    // Insert profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      user_id: newUserId,
      first_name: firstName,
      last_name: lastName,
      is_super_admin: false,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: profileError.message || "Failed to create profile" }, { status: 500 });
    }

    // Insert org membership
    const { error: membershipError } = await supabaseAdmin.from('organization_members').insert({
      org_id: orgId,
      user_id: newUserId,
      role: role ?? 'org:transportista',
      status: 'active',
    });
    if (membershipError) {
      console.warn('organization_members insert skipped during create-user:', membershipError);
    }

    // Generate password-reset link so user can set their own password
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${req.nextUrl.origin}/set-password`,
      },
    });

    // Look up org name
    const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', orgId).single();
    const orgName = org?.name ?? orgId;

    if (linkData?.properties?.action_link) {
      const welcomeResult = await sendWelcomeEmail({
        to: email,
        setupLink: linkData.properties.action_link,
        orgName,
        firstName,
      });
      if (welcomeResult.error) {
        console.error('Resend error:', welcomeResult.error);
      } else {
        console.log('Welcome email sent to:', email);
      }
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create user" }, { status: 500 });
  }
}
