export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import type { VirtualitiCustomer } from '@virtualiti-peru/universal-auth/core';
import { ApiErrors } from '@/lib/api-errors';
import { auth } from '@/lib/auth';
import { canAccessOrganization, getApiAuthContext } from '@/lib/api-auth-context';
import { canViewOrgPlanUsage } from '@/lib/portal-access';
import type { OrganizationUsage } from '@/lib/organization-limits';
import type { PlanTier } from '@/lib/plans';
import { getServerAccessToken } from '@/lib/server-auth-token';
import { getVouchekEntitlementForTenant } from '@/lib/universal-auth-api';

type AzureCustomerUsage = {
  currentUsers?: number;
  totalTransactionsThisMonth?: number;
  maxUsers?: number;
};

type EntitlementSnapshot = {
  planCode: string | null;
  status: string | null;
  effectiveStatus: string | null;
  isUsable: boolean;
  trialEndsAt: string | null;
  maxUsers: number;
  maxReceipts: number;
};

function currentPeriodKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function fromSessionTenant(tenant: VirtualitiCustomer): EntitlementSnapshot {
  const status = tenant.status ?? null;
  return {
    planCode: tenant.planCode ?? null,
    status,
    effectiveStatus: status,
    isUsable: (status ?? '').toLowerCase() === 'active' || (status ?? '').toLowerCase() === 'trial',
    trialEndsAt: tenant.trialEndsAt ?? null,
    maxUsers: tenant.limits?.maxUsers ?? 0,
    maxReceipts: tenant.limits?.maxReceipts ?? 0,
  };
}

async function resolveEntitlement(
  orgId: string,
  isSuperAdmin: boolean,
  sessionTenants: VirtualitiCustomer[] | undefined,
): Promise<EntitlementSnapshot | null> {
  const fromSession = sessionTenants?.find((t) => t.customerId === orgId);
  if (fromSession) {
    return fromSessionTenant(fromSession);
  }

  // SuperAdmin viewing another tenant: admin UA API.
  if (!isSuperAdmin) {
    return null;
  }

  try {
    const entitlement = await getVouchekEntitlementForTenant(orgId);
    if (!entitlement) return null;
    return {
      planCode: entitlement.planCode ?? null,
      status: entitlement.status ?? null,
      effectiveStatus: entitlement.effectiveStatus ?? entitlement.status ?? null,
      isUsable: entitlement.isUsable !== false,
      trialEndsAt: entitlement.trialEndsAt ?? null,
      maxUsers: entitlement.limits?.maxUsers ?? 0,
      maxReceipts: entitlement.limits?.maxReceipts ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchAzureCustomerUsage(orgId: string): Promise<AzureCustomerUsage | null> {
  const apiBaseUrl = process.env.API_BASE_URL?.trim().replace(/\/$/, '');
  if (!apiBaseUrl) return null;

  const token = await getServerAccessToken();
  if (!token) return null;

  const now = new Date();
  const url = new URL(`/api/customers/${encodeURIComponent(orgId)}/usage`, apiBaseUrl);
  url.searchParams.set('year', String(now.getUTCFullYear()));
  url.searchParams.set('month', String(now.getUTCMonth() + 1));

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as AzureCustomerUsage;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const normalizedOrgId = orgId?.trim();
    if (!normalizedOrgId) {
      return NextResponse.json({ error: ApiErrors.MISSING_ORG_ID }, { status: 400 });
    }

    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getApiAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (
      !canViewOrgPlanUsage({ userId: user.id, orgId: callerOrgId, role, isSuperAdmin })
      || !canAccessOrganization(isSuperAdmin, callerOrgId, normalizedOrgId)
    ) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const session = await auth();
    const entitlement = await resolveEntitlement(
      normalizedOrgId,
      isSuperAdmin,
      session?.tenants,
    );
    const azureUsage = await fetchAzureCustomerUsage(normalizedOrgId);

    const maxUsers = entitlement?.maxUsers || azureUsage?.maxUsers || 0;
    const maxReceiptsPerMonth = entitlement?.maxReceipts ?? 0;
    const activeUsers = azureUsage?.currentUsers ?? 0;
    const receiptsUsed = azureUsage?.totalTransactionsThisMonth ?? 0;
    const usersReserved = activeUsers;
    const effective = (entitlement?.effectiveStatus ?? entitlement?.status ?? '').toLowerCase();
    const trialEndsAt = entitlement?.trialEndsAt ?? null;
    const subscriptionExpired =
      effective === 'expired'
      || (
        trialEndsAt != null
        && new Date(trialEndsAt).getTime() < Date.now()
        && effective === 'trial'
      );

    const usage: OrganizationUsage = {
      orgId: normalizedOrgId,
      planTier: (entitlement?.planCode ?? 'trial') as PlanTier,
      periodKey: currentPeriodKey(),
      maxUsers,
      maxReceiptsPerMonth,
      activeUsers,
      pendingInvites: 0,
      usersReserved,
      usersRemaining: Math.max(0, maxUsers - usersReserved),
      receiptsUsed,
      receiptsRemaining: Math.max(0, maxReceiptsPerMonth - receiptsUsed),
      allowReceiptOverage: false,
      isActive: entitlement ? entitlement.isUsable && effective !== 'suspended' : true,
      subscriptionEndsAt: trialEndsAt,
      monthlyFeePen: null,
      demoEnabled: effective === 'trial',
      demoDays: null,
      subscriptionExpired,
      accessBlocked:
        subscriptionExpired
        || effective === 'suspended'
        || entitlement?.isUsable === false,
    };

    return NextResponse.json(usage);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
