import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/clerk-sdk-node";

export async function POST(req: NextRequest) {
  try {
    const { email, firstName, lastName, orgId } = await req.json();
    if (!email || !orgId) {
      return NextResponse.json({ error: "Missing email or orgId" }, { status: 400 });
    }
    // Create user in Clerk
    const user = await clerkClient.users.createUser({
      emailAddress: email,
      firstName,
      lastName
    });
    // Add user to organization
    await clerkClient.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId: user.id,
      role: "member" // or "admin" if you want admin rights
    });
    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create user" }, { status: 500 });
  }
}
