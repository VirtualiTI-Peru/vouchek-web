import "server-only";

import {
  isSubscriptionUsable,
  resolveEffectiveSubscriptionStatus,
  type VirtualitiCustomer,
} from "@virtualiti-peru/universal-auth/core";
import { auth } from "@/lib/auth";
import { getVouchekEntitlementForTenant } from "@/lib/universal-auth-api";

export type OrganizationAccessStatus = {
  blocked: boolean;
  isActive: boolean;
  subscriptionEndsAt: string | null;
  demoEnabled: boolean;
  demoExpired: boolean;
};

type EntitlementHint = {
  status?: string | null;
  planCode?: string | null;
  trialEndsAt?: string | null;
  isUsable?: boolean;
};

function fromHint(hint: EntitlementHint | null | undefined): OrganizationAccessStatus {
  const fallback: OrganizationAccessStatus = {
    blocked: false,
    isActive: true,
    subscriptionEndsAt: null,
    demoEnabled: false,
    demoExpired: false,
  };

  if (!hint) return fallback;

  const status = hint.status ?? null;
  const planCode = hint.planCode ?? null;
  const trialEndsAt = hint.trialEndsAt ?? null;
  const effective = resolveEffectiveSubscriptionStatus(status, trialEndsAt, new Date(), planCode);
  const usable =
    hint.isUsable !== undefined
      ? hint.isUsable && (effective === "trial" || effective === "active")
      : isSubscriptionUsable(status, trialEndsAt, planCode);
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
  };
}

async function resolveHint(
  orgId: string,
  isSuperAdmin: boolean,
  sessionTenants: VirtualitiCustomer[] | undefined,
): Promise<EntitlementHint | null> {
  const fromSession = sessionTenants?.find((t) => t.customerId === orgId);
  if (fromSession) {
    return {
      status: fromSession.status ?? null,
      planCode: fromSession.planCode ?? null,
      trialEndsAt: fromSession.trialEndsAt ?? null,
    };
  }

  if (!isSuperAdmin) {
    return null;
  }

  try {
    const entitlement = await getVouchekEntitlementForTenant(orgId);
    if (!entitlement) return null;
    return {
      status: entitlement.effectiveStatus ?? entitlement.status ?? null,
      planCode: entitlement.planCode ?? null,
      trialEndsAt: entitlement.trialEndsAt ?? null,
      isUsable: entitlement.isUsable,
    };
  } catch {
    return null;
  }
}

/**
 * Portal access gate from Universal Auth subscription (trial/active/suspended).
 */
export async function getOrganizationAccessStatus(
  orgId: string,
): Promise<OrganizationAccessStatus> {
  const fallback: OrganizationAccessStatus = {
    blocked: false,
    isActive: true,
    subscriptionEndsAt: null,
    demoEnabled: false,
    demoExpired: false,
  };

  if (!orgId) {
    return fallback;
  }

  try {
    const session = await auth();
    if (session?.isSuperAdmin) {
      return fallback;
    }

    const hint = await resolveHint(orgId, session?.isSuperAdmin === true, session?.tenants);
    return fromHint(hint);
  } catch (error) {
    console.error("organization access lookup failed:", error);
    return fallback;
  }
}
