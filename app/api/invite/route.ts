import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  try {
    const { email, orgId } = await req.json();
    if (!email || !orgId) {
      return NextResponse.json({ error: "Missing email or orgId" }, { status: 400 });
    }
    // Send invitation using Clerk API
    const client = await clerkClient();
    const invitation = await client.invitations.createInvitation({
      emailAddress: email
    });
    return NextResponse.json({ invitation });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to send invitation" }, { status: 500 });
  }
}
