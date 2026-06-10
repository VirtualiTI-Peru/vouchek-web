import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ApiErrors } from "@/lib/api-errors";

function getServerClient(req: NextRequest) {
  return createServerClient(
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
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthContext(req: NextRequest) {
  const supabase = getServerClient(req);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isSuperAdmin: false, role: "", orgId: "" };
  }

  const supabaseAdmin = getAdminClient();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .single();

  return {
    user,
    isSuperAdmin: profile?.is_super_admin === true,
    role: String(user.app_metadata?.role ?? ""),
    orgId: String(user.app_metadata?.org_id ?? ""),
  };
}

function canManageInvitations(isSuperAdmin: boolean, role: string) {
  return isSuperAdmin || role === "org:admin" || role === "org:sistema";
}

function canAccessOrg(isSuperAdmin: boolean, callerOrgId: string, orgId: string) {
  return isSuperAdmin || callerOrgId === orgId;
}

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: ApiErrors.MISSING_ORG_ID }, { status: 400 });
    }

    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!canManageInvitations(isSuperAdmin, role)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    if (!canAccessOrg(isSuperAdmin, callerOrgId, orgId)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, expires_at, accepted_at, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message || ApiErrors.LOAD_INVITATIONS }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || ApiErrors.LOAD_INVITATIONS }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: ApiErrors.MISSING_INVITATION_ID }, { status: 400 });
    }

    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!canManageInvitations(isSuperAdmin, role)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();
    const { data: invitation, error: lookupError } = await supabaseAdmin
      .from("invitations")
      .select("id, org_id, accepted_at")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message || ApiErrors.DELETE_INVITATION }, { status: 500 });
    }

    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 });
    }

    if (invitation.accepted_at) {
      return NextResponse.json({ error: "No se puede revocar una invitación ya aceptada." }, { status: 400 });
    }

    if (!canAccessOrg(isSuperAdmin, callerOrgId, invitation.org_id)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("invitations")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message || ApiErrors.DELETE_INVITATION }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || ApiErrors.DELETE_INVITATION }, { status: 500 });
  }
}
