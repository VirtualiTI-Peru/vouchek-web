import { NextRequest, NextResponse } from "next/server";
import { ApiErrors } from "@/lib/api-errors";
import { canAccessOrganization, getApiAuthContext } from "@/lib/api-auth-context";
import { isVouchekRole, VOUCHEK_ROLES } from "@/lib/roles";
import { getVouchekDataSupabaseAdmin } from "@/lib/vouchek-data-supabase";

function canManageInvitations(isSuperAdmin: boolean, role: string) {
  return isSuperAdmin || isVouchekRole(role, VOUCHEK_ROLES.ADMIN, VOUCHEK_ROLES.SISTEMA);
}

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: ApiErrors.MISSING_ORG_ID }, { status: 400 });
    }

    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getApiAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!canManageInvitations(isSuperAdmin, role)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    if (!canAccessOrganization(isSuperAdmin, callerOrgId, orgId)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const dataAdmin = getVouchekDataSupabaseAdmin();
    const { data, error } = await dataAdmin
      .from("invitations")
      .select("id, email, role, expires_at, accepted_at, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message || ApiErrors.LOAD_INVITATIONS }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ApiErrors.LOAD_INVITATIONS;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: ApiErrors.MISSING_INVITATION_ID }, { status: 400 });
    }

    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getApiAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!canManageInvitations(isSuperAdmin, role)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const dataAdmin = getVouchekDataSupabaseAdmin();
    const { data: invitation, error: lookupError } = await dataAdmin
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

    if (!canAccessOrganization(isSuperAdmin, callerOrgId, invitation.org_id)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const { error } = await dataAdmin
      .from("invitations")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message || ApiErrors.DELETE_INVITATION }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ApiErrors.DELETE_INVITATION;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
