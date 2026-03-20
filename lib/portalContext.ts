import { auth } from '@clerk/nextjs/server';

export type PortalRole = 'org:verificador' | 'org:admin' | string;

export type PortalContext = {
  userId: string;
  orgId: string;
  email?: string;
  role?: PortalRole;
  isSuperAdmin: boolean;
  fullName?: string;
};

function parseJwtPayload(token: string): any {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const json = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(json);
}

export async function getPortalContext(): Promise<PortalContext> {
  const session = await auth();
  if (!session.userId) {
    throw new Error('Not authenticated');
  }

  const template = process.env.CLERK_JWT_TEMPLATE;
  const token = await session.getToken(template ? { template } : undefined);
  if (!token) {
    throw new Error('Missing auth token');
  }

  const claims = parseJwtPayload(token) ?? {};
  const email = claims?.Email as string | undefined;
  const orgId = (claims?.OrgId as string | undefined) ?? '';
  const role = claims?.Role as PortalRole | undefined;
  const fullName = ((claims?.LastName ?? '') + ' ' + (claims?.FirstName ?? '')).trim() as string | undefined;

  const superAdmins = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS ?? '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  const isSuperAdmin = !!email && superAdmins.some(e => e.toLowerCase() === email.toLowerCase());

  if (!orgId && !isSuperAdmin) {
    throw new Error('Missing OrgId claim');
  }

  return {
    userId: session.userId,
    orgId,
    email,
    role,
    isSuperAdmin,
    fullName,
  };
}
