import "server-only";

import {
  isJwtSubscriptionInactive,
  isSubscriptionUsable,
  resolveEffectiveSubscriptionStatus,
  type VirtualitiCustomer,
} from "@virtualiti-peru/universal-auth/core";
import { auth } from "@/lib/auth";
import { getServerAccessToken } from "@/lib/server-auth-token";

export type OrganizationAccessStatus = {
  blocked: boolean;
  isActive: boolean;
  subscriptionEndsAt: string | null;
  demoEnabled: boolean;
  demoExpired: boolean;
  overdueInvoice: boolean;
};

type AccessApiResponse = {
  blocked?: boolean;
  isActive?: boolean;
  demoEnabled?: boolean;
  demoExpired?: boolean;
  subscriptionEndsAt?: string | null;
  overdueInvoice?: boolean;
  billingAccess?: string | null;
  effectiveStatus?: string | null;
  openInvoice?: { dueAt?: string | null } | null;
};

function emptyAccess(): OrganizationAccessStatus {
  return {
    blocked: false,
    isActive: true,
    subscriptionEndsAt: null,
    demoEnabled: false,
    demoExpired: false,
    overdueInvoice: false,
  };
}

function fromJwtTenant(tenant: VirtualitiCustomer | undefined): OrganizationAccessStatus {
  const fallback = emptyAccess();
  if (!tenant) return fallback;

  const status = tenant.status ?? null;
  const planCode = tenant.planCode ?? null;
  const trialEndsAt = tenant.trialEndsAt ?? null;
  const effective = resolveEffectiveSubscriptionStatus(status, trialEndsAt, new Date(), planCode);
  const usable = isSubscriptionUsable(status, trialEndsAt, planCode);
  const isTrial = effective === "trial" || (planCode ?? "").toLowerCase() === "trial";
  const trialExpired =
    isTrial
    && trialEndsAt != null
    && !Number.isNaN(Date.parse(trialEndsAt))
    && Date.now() > Date.parse(trialEndsAt);

  return {
    blocked: !usable || effective === "suspended" || effective === "cancelled",
    isActive: usable,
    subscriptionEndsAt: trialEndsAt,
    demoEnabled: isTrial,
    demoExpired: trialExpired,
    overdueInvoice: false,
  };
}

async function fetchAccessFromApi(orgId: string): Promise<OrganizationAccessStatus | null> {
  const baseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return null;
  }

  const token = await getServerAccessToken();
  if (!token) {
    return null;
  }

  const url = new URL("/api/me/access", `${baseUrl}/`);
  url.searchParams.set("customerId", orgId);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as AccessApiResponse;
  const overdueInvoice =
    data.overdueInvoice === true
    || (data.billingAccess === "access_locked" && Boolean(data.openInvoice));

  return {
    blocked: data.blocked === true || overdueInvoice,
    isActive: data.isActive === true && !overdueInvoice,
    subscriptionEndsAt: data.subscriptionEndsAt ?? null,
    demoEnabled: data.demoEnabled === true,
    demoExpired: data.demoExpired === true,
    overdueInvoice,
  };
}

/**
 * Portal access gate: entitlements (incl. factura vencida) with JWT fallback.
 */
export async function getOrganizationAccessStatus(
  orgId: string,
): Promise<OrganizationAccessStatus> {
  const fallback = emptyAccess();

  if (!orgId) {
    return fallback;
  }

  try {
    const session = await auth();
    if (session?.isSuperAdmin) {
      return fallback;
    }

    const fromApi = await fetchAccessFromApi(orgId).catch(() => null);
    if (fromApi) {
      return fromApi;
    }

    const jwtTenant = session?.tenants?.find((t) => t.customerId === orgId);
    const fromJwt = fromJwtTenant(jwtTenant);
    if (isJwtSubscriptionInactive(session) || fromJwt.blocked) {
      return { ...fromJwt, blocked: true, isActive: false };
    }

    return fromJwt;
  } catch (error) {
    console.error("organization access lookup failed:", error);
    return fallback;
  }
}
