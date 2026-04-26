import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { sendInviteEmail } from "@/lib/sendInviteEmail";
import { createHash, randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email, orgId, role } = await req.json();
    if (!email || !orgId || !role) {
      return NextResponse.json({ error: "Missing email, orgId or role" }, { status: 400 });
    }

    // Verify caller is authenticated
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll() {},
        },
      }
    );
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) {
      return NextResponse.json({ error: "No authenticated user found" }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const normalizedEmail = String(email).trim().toLowerCase();

    // Prevent duplicate pending invites for the same organization/email.
    const { data: existingInvite } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", normalizedEmail)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (existingInvite?.id) {
      return NextResponse.json({ error: "Ya existe una invitacion pendiente para este usuario." }, { status: 409 });
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: invitationError } = await supabaseAdmin
      .from("invitations")
      .insert({
        org_id: orgId,
        email: normalizedEmail,
        role,
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by: caller.id,
      });

    if (invitationError) {
      return NextResponse.json({ error: invitationError.message || "Error al crear invitacion" }, { status: 500 });
    }

    // Use INVITE_BASE_URL if set, else fallback to request origin
    const baseUrl = process.env.INVITE_BASE_URL || req.nextUrl.origin;
    const inviteLink = `${baseUrl}/accept-invite?token=${encodeURIComponent(rawToken)}`;

    // Look up org name and caller profile for the email
    const [{ data: org }, { data: callerProfile }] = await Promise.all([
      supabaseAdmin.from('organizations').select('name').eq('id', orgId).single(),
      supabaseAdmin.from('profiles').select('first_name, last_name').eq('user_id', caller.id).single(),
    ]);

    const orgName = org?.name ?? orgId;
    const invitedBy = [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(' ') || caller.email!;

    // Send custom invite email via Resend
    const emailResult = await sendInviteEmail({ to: email, inviteLink, orgName, invitedBy, role });
    if (emailResult.error) {
      console.error('Resend error:', emailResult.error);
      // The invitation is already stored, so we keep success and allow re-send flows later.
    } else {
      console.log('Invite email sent to:', email);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to send invitation" }, { status: 500 });
  }
}
