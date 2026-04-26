import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const supabase = getServerClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, expires_at, accepted_at, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load invitations" }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load invitations" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing invitation id" }, { status: 400 });
    }

    const supabase = getServerClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from("invitations")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete invitation" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete invitation" }, { status: 500 });
  }
}
