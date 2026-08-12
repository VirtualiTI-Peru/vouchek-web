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

export type ProvisionUserPayload = {
  email: string;
  tenantId: string;
  roleSlug: string;
  fullName?: string;
};

export type ProvisionUserResult = {
  created?: boolean;
  assignedExisting?: boolean;
  email?: string;
  profileId?: string;
  emailSent?: boolean;
  message?: string;
  code?: string;
};

export type ProvisionUserResponse =
  | { ok: true; status: number; data: ProvisionUserResult }
  | { ok: false; status: number; error: string; code?: string };

/** Provision via Universal Auth API (cupo + correo de bienvenida). */
export async function provisionVouchekUser(
  payload: ProvisionUserPayload,
): Promise<ProvisionUserResponse> {
  const api = await getUniversalAuthApi();
  const response = await api.apiFetch("/Users/provision", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      applicationId: VOUCHEK_APPLICATION_ID,
      tenantId: payload.tenantId,
      roleSlug: payload.roleSlug,
      fullName: payload.fullName,
    }),
  });

  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : `No se pudo crear el usuario (${response.status}).`;
    return {
      ok: false,
      status: response.status,
      error: message,
      code: typeof body?.code === "string" ? body.code : undefined,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: body as ProvisionUserResult,
  };
}

/** Password reset via Universal Auth API (same flow as UA admin UI). */
export async function sendVouchekPasswordReset(params: {
  profileId: string;
  tenantId: string;
}): Promise<
  | { ok: true; status: number; message?: string; email?: string }
  | { ok: false; status: number; error: string }
> {
  const api = await getUniversalAuthApi();
  const qs = new URLSearchParams({
    applicationId: VOUCHEK_APPLICATION_ID,
    tenantId: params.tenantId,
  });
  const response = await api.apiFetch(
    `/Users/${encodeURIComponent(params.profileId)}/reset-password?${qs.toString()}`,
    { method: "POST" },
  );

  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : `No se pudo enviar el restablecimiento (${response.status}).`;
    return { ok: false, status: response.status, error: message };
  }

  return {
    ok: true,
    status: response.status,
    message: typeof body?.message === "string" ? body.message : undefined,
    email: typeof body?.email === "string" ? body.email : undefined,
  };
}
