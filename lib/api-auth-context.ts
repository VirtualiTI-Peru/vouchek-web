import type { NextRequest } from 'next/server';
import { auth, VOUCHEK_APPLICATION_ID } from '@/lib/auth';
import { normalizeVouchekRole } from '@/lib/roles';

export type ApiAuthContext = {
  user: { id: string; email?: string } | null;
  isSuperAdmin: boolean;
  role: string;
  orgId: string;
};

type VirtualitiTenant = {
  tenant_id?: string;
  tenantId?: string;
  slug?: string;
  role?: string;
};

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function contextFromJwtPayload(
  userId: string,
  email: string | undefined,
  payload: Record<string, unknown>,
): ApiAuthContext {
  const userMetadata = (payload.user_metadata ?? {}) as Record<string, unknown>;
  const virtualiti = (userMetadata.virtualiti ?? {}) as Record<string, unknown>;
  const isSuperAdmin = virtualiti.is_super_admin === true;
  const applications = Array.isArray(virtualiti.applications) ? virtualiti.applications : [];
  const app = applications.find((item) => {
    const row = item as Record<string, unknown>;
    return String(row.application_id ?? row.applicationId ?? '') === VOUCHEK_APPLICATION_ID;
  }) as Record<string, unknown> | undefined;

  const tenants = Array.isArray(app?.tenants) ? (app?.tenants as VirtualitiTenant[]) : [];
  const primary = tenants[0];
  const orgId = String(primary?.tenant_id ?? primary?.tenantId ?? '');
  const role = normalizeVouchekRole(primary?.slug ?? primary?.role) ?? '';

  return {
    user: { id: userId, email },
    isSuperAdmin,
    role,
    orgId,
  };
}

async function getBearerAuthContext(req: NextRequest): Promise<ApiAuthContext | null> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const authUser = (await response.json()) as { id?: string; email?: string };
  if (!authUser.id) return null;

  const payload = parseJwtPayload(token);
  if (!payload) {
    return {
      user: { id: authUser.id, email: authUser.email },
      isSuperAdmin: false,
      role: '',
      orgId: '',
    };
  }

  return contextFromJwtPayload(authUser.id, authUser.email, payload);
}

export async function getApiAuthContext(req?: NextRequest | unknown): Promise<ApiAuthContext> {
  const session = await auth();
  if (session) {
    const userId = session.userId ?? (session.user as { id?: string } | undefined)?.id;
    if (userId) {
      return {
        user: { id: userId, email: session.user?.email ?? undefined },
        isSuperAdmin: session.isSuperAdmin === true,
        role: normalizeVouchekRole(session.appRoleSlug ?? session.appRole) ?? '',
        orgId: session.primaryTenantId?.trim() || session.tenantIds?.[0]?.trim() || '',
      };
    }
  }

  if (req && typeof req === 'object' && req !== null && 'headers' in req) {
    const bearer = await getBearerAuthContext(req as NextRequest);
    if (bearer?.user) return bearer;
  }

  return { user: null, isSuperAdmin: false, role: '', orgId: '' };
}

export function canAccessOrganization(
  isSuperAdmin: boolean,
  callerOrgId: string,
  targetOrgId: string,
): boolean {
  return isSuperAdmin || (!!callerOrgId && callerOrgId === targetOrgId);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
