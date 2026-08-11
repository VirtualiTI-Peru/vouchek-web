import {
  createApiClient,
  getApiAccessToken,
} from "@virtualiti-peru/universal-auth/next";
import { VOUCHEK_APPLICATION_ID } from "@/lib/auth";

const DEFAULT_UA_API = "https://universal-auth-api.azurewebsites.net";

export type UaTenant = {
  id: string;
  name: string;
  ruc?: string | null;
  code?: string | null;
  isActive?: boolean;
};

export type UaEntitlementLimits = {
  maxClients?: number | null;
  maxUsers?: number | null;
  maxReceipts?: number | null;
};

export type UaApplicationTenant = {
  applicationId: string;
  applicationName?: string;
  tenantId: string;
  planCode?: string | null;
  status?: string | null;
  effectiveStatus?: string | null;
  isUsable?: boolean;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  limits?: UaEntitlementLimits | null;
};

function getUniversalAuthApiBaseUrl(): string {
  const raw =
    process.env.UNIVERSAL_AUTH_API_BASE_URL?.trim()
    || process.env.NEXT_PUBLIC_UNIVERSAL_AUTH_API_BASE_URL?.trim()
    || DEFAULT_UA_API;
  return raw.replace(/\/$/, "");
}

/** API client for Universal Auth admin endpoints via SDK. */
export async function getUniversalAuthApi() {
  const tokenResult = await getApiAccessToken();
  if (!tokenResult.ok) {
    throw new Error(tokenResult.error);
  }

  return createApiClient({
    baseUrl: `${getUniversalAuthApiBaseUrl()}/api`,
    getToken: async () => tokenResult.token,
  });
}

export async function listUaTenants(): Promise<UaTenant[]> {
  const api = await getUniversalAuthApi();
  return api.apiFetchJson<UaTenant[]>("/Tenants");
}

export async function listUaApplicationTenants(): Promise<UaApplicationTenant[]> {
  const api = await getUniversalAuthApi();
  return api.apiFetchJson<UaApplicationTenant[]>("/ApplicationTenants");
}

/** Tenant IDs that have VouChek assigned (any status / plan). */
export async function listVouchekAssignedTenantIds(): Promise<Set<string>> {
  const appId = VOUCHEK_APPLICATION_ID.toLowerCase();
  const assignments = await listUaApplicationTenants();
  return new Set(
    assignments
      .filter((row) => row.applicationId?.toLowerCase() === appId && Boolean(row.tenantId))
      .map((row) => row.tenantId),
  );
}

export async function getVouchekEntitlementForTenant(
  tenantId: string,
): Promise<UaApplicationTenant | null> {
  const api = await getUniversalAuthApi();
  const rows = await api.apiFetchJson<UaApplicationTenant[]>(
    `/ApplicationTenants/tenant/${tenantId}`,
  );
  const appId = VOUCHEK_APPLICATION_ID.toLowerCase();
  return (
    rows.find((row) => row.applicationId?.toLowerCase() === appId)
    ?? null
  );
}
