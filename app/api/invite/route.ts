import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/clerk-sdk-node";

export async function POST(req: NextRequest) {
  try {
    const { email, orgId } = await req.json();
    if (!email || !orgId) {
      return NextResponse.json({ error: "Missing email or orgId" }, { status: 400 });
    }
    // Check if user already exists in the organization
    const memberships = await clerkClient.organizations.getOrganizationMembershipList({ organizationId: orgId });
    const exists = memberships.some((m: any) => m.publicUserData?.identifier?.toLowerCase() === email.toLowerCase() || m.publicUserData?.emailAddress?.toLowerCase() === email.toLowerCase());
    if (exists) {
      return NextResponse.json({ error: "El usuario ya existe en la organización." }, { status: 409 });
    }
    // Send invitation using Clerk API
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email
    });
    return NextResponse.json({ invitation });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to send invitation" }, { status: 500 });
  }
}
