import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: invitation, error } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, org_id, expires_at, accepted_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to validate invitation" }, { status: 500 });
    }

    if (!invitation) {
      return NextResponse.json({ error: "Invitacion invalida." }, { status: 404 });
    }

    if (invitation.accepted_at) {
      return NextResponse.json({ error: "Esta invitacion ya fue utilizada." }, { status: 410 });
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Esta invitacion ya expiro." }, { status: 410 });
    }

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      orgId: invitation.org_id,
      expiresAt: invitation.expires_at,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to validate invitation" }, { status: 500 });
  }
}
