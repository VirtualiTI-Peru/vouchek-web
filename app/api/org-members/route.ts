import { NextRequest } from 'next/server';
import { clerkClient } from '@clerk/clerk-sdk-node';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) {
      return new Response(JSON.stringify([]), { status: 400 });
    }
    const memberships = await clerkClient.organizations.getOrganizationMembershipList({ organizationId: orgId });
    const users = await Promise.all(
      memberships.map(async (m: any) => {
        const user = await clerkClient.users.getUser(m.publicUserData.userId);
        return {
          id: user.id,
          email: user.emailAddresses?.[0]?.emailAddress,
          role: m.role,
          username:
            user.username ||
            [user.firstName || m.publicUserData.firstName, user.lastName || m.publicUserData.lastName].filter(Boolean).join(' '),
          // Clerk User does not have 'deletedAt' or 'status'; always return 'active'
          status: 'active',
          lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt).toISOString() : '',
        };
      })
    );
    return new Response(JSON.stringify(users), { status: 200 });
  } catch (err) {
    console.error('org-members API error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message || 'Unknown error' }), { status: 500 });
  }
}