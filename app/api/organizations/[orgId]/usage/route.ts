export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import type { VirtualitiCustomer } from '@virtualiti-peru/universal-auth/core';
import { ApiErrors } from '@/lib/api-errors';
import { auth, VOUCHEK_APPLICATION_ID } from '@/lib/auth';
import { canAccessOrganization, getApiAuthContext } from '@/lib/api-auth-context';
import { canViewOrgPlanUsage } from '@/lib/portal-access';
import type { OrganizationUsage } from '@/lib/organization-limits';
import {
  extraCount,
  isTrialPlan,
  PAID_INCLUDED_RECEIPTS,
  PAID_INCLUDED_USERS,
  STANDARD_FEE_PEN,
  type PlanTier,
} from '@/lib/plans';
import { getServerAccessToken } from '@/lib/server-auth-token';
import { getUniversalAuthAdmin } from '@/lib/universal-auth-admin';
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
  maxUsers: number | null;
  maxReceipts: number | null;
  includedUsers: number | null;
  includedReceipts: number | null;
};

function limaPeriodKey(now = new Date()): { periodKey: string; year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? now.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? now.getUTCMonth() + 1);
  return {
    year,
    month,
    periodKey: `${year}-${String(month).padStart(2, '0')}`,
  };
}

function readOptionalInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readLimit(limits: Record<string, unknown> | null | undefined, camel: string, snake: string): number | null {
  if (!limits) return null;
  return readOptionalInt(limits[camel] ?? limits[snake]);
}

function fromSessionTenant(tenant: VirtualitiCustomer): EntitlementSnapshot {
  const status = tenant.status ?? null;
  const limits = (tenant.limits ?? {}) as Record<string, unknown>;
  return {
    planCode: tenant.planCode ?? null,
    status,
    effectiveStatus: status,
    isUsable: (status ?? '').toLowerCase() === 'active' || (status ?? '').toLowerCase() === 'trial',
    trialEndsAt: tenant.trialEndsAt ?? null,
    maxUsers: readLimit(limits, 'maxUsers', 'max_users'),
    maxReceipts: readLimit(limits, 'maxReceipts', 'max_receipts'),
    includedUsers: readLimit(limits, 'includedUsers', 'included_users'),
    includedReceipts: readLimit(limits, 'includedReceipts', 'included_receipts'),
  };
}

async function resolveEntitlement(
  orgId: string,
  isSuperAdmin: boolean,
  sessionTenants: VirtualitiCustomer[] | undefined,
): Promise<EntitlementSnapshot | null> {
  try {
    const entitlement = await getVouchekEntitlementForTenant(orgId);
    if (entitlement) {
      const limits = (entitlement.limits ?? {}) as Record<string, unknown>;
      return {
        planCode: entitlement.planCode ?? null,
        status: entitlement.status ?? null,
        effectiveStatus: entitlement.effectiveStatus ?? entitlement.status ?? null,
        isUsable: entitlement.isUsable !== false,
        trialEndsAt: entitlement.trialEndsAt ?? null,
        maxUsers: readLimit(limits, 'maxUsers', 'max_users'),
        maxReceipts: readLimit(limits, 'maxReceipts', 'max_receipts'),
        includedUsers: readLimit(limits, 'includedUsers', 'included_users'),
        includedReceipts: readLimit(limits, 'includedReceipts', 'included_receipts'),
      };
    }
  } catch {
    // Fall through to JWT session.
  }

  const fromSession = sessionTenants?.find((t) => t.customerId === orgId);
  if (fromSession) {
    return fromSessionTenant(fromSession);
  }

  if (!isSuperAdmin) {
    return null;
  }

  return null;
}

async function fetchAzureCustomerUsage(orgId: string, year: number, month: number): Promise<AzureCustomerUsage | null> {
  const apiBaseUrl = process.env.API_BASE_URL?.trim().replace(/\/$/, '');
  if (!apiBaseUrl) return null;

  const token = await getServerAccessToken();
  if (!token) return null;

  const url = new URL(`/api/customers/${encodeURIComponent(orgId)}/usage`, apiBaseUrl);
  url.searchParams.set('year', String(year));
  url.searchParams.set('month', String(month));

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

async function countTenantUsers(orgId: string): Promise<number> {
  try {
    const uaAdmin = getUniversalAuthAdmin();
    const { count, error } = await uaAdmin
      .from('tenant_users')
      .select('profile_id', { count: 'exact', head: true })
      .eq('application_id', VOUCHEK_APPLICATION_ID)
      .eq('tenant_id', orgId);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

function resolveIncluded(
  isTrial: boolean,
  included: number | null,
  max: number | null,
  paidDefault: number,
  trialDefault: number,
): number {
  const hasIncluded = included != null && included >= 0;
  const hasMax = max != null && max >= 0;
  // Prefer Universal Auth. If catalog still has 6000 included but the assignment
  // was lowered via max_receipts, use the tighter cap.
  if (hasIncluded && hasMax) return Math.min(included, max);
  if (hasIncluded) return included;
  if (hasMax) return max;
  if (isTrial) return trialDefault;
  return paidDefault;
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
    const { periodKey, year, month } = limaPeriodKey();
    const [azureUsage, activeUsers] = await Promise.all([
      fetchAzureCustomerUsage(normalizedOrgId, year, month),
      countTenantUsers(normalizedOrgId),
    ]);

    const effective = (entitlement?.effectiveStatus ?? entitlement?.status ?? '').toLowerCase();
    const isTrial = isTrialPlan(entitlement?.planCode, effective || entitlement?.status);
    const includedUsers = resolveIncluded(
      isTrial,
      entitlement?.includedUsers ?? null,
      entitlement?.maxUsers ?? null,
      PAID_INCLUDED_USERS,
      1,
    );
    const includedReceipts = resolveIncluded(
      isTrial,
      entitlement?.includedReceipts ?? null,
      entitlement?.maxReceipts ?? null,
      PAID_INCLUDED_RECEIPTS,
      100,
    );

    const receiptsUsed = azureUsage?.totalTransactionsThisMonth ?? 0;
    const usersReserved = activeUsers;
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
      planTier: (entitlement?.planCode ?? (isTrial ? 'trial' : 'standard')) as PlanTier,
      periodKey,
      includedUsers,
      includedReceiptsPerMonth: includedReceipts,
      maxUsers: isTrial ? (entitlement?.maxUsers ?? includedUsers) : null,
      maxReceiptsPerMonth: isTrial ? (entitlement?.maxReceipts ?? includedReceipts) : null,
      activeUsers,
      pendingInvites: 0,
      usersReserved,
      extraUsers: isTrial ? 0 : extraCount(usersReserved, includedUsers),
      receiptsUsed,
      extraReceipts: isTrial ? 0 : extraCount(receiptsUsed, includedReceipts),
      isTrial,
      isActive: entitlement ? entitlement.isUsable && effective !== 'suspended' : true,
      subscriptionEndsAt: trialEndsAt,
      monthlyFeePen: isTrial ? null : STANDARD_FEE_PEN,
      demoEnabled: isTrial,
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
