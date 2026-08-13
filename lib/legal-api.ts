import "server-only";

import { getServerAccessToken } from "@/lib/server-auth-token";

type LegalEstadoResponse = {
  accepted?: boolean;
  version?: string | null;
  acceptedAtUtc?: string | null;
};

function getApiBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Missing API_BASE_URL");
  }
  return baseUrl;
}

async function resolveAccessToken(accessToken?: string | null): Promise<string> {
  const fromCaller = accessToken?.trim();
  if (fromCaller) return fromCaller;

  const fromSession = await getServerAccessToken();
  if (!fromSession) {
    throw new Error("Missing auth token");
  }
  return fromSession;
}

async function legalFetch<T>(
  path: string,
  init?: RequestInit,
  accessToken?: string | null,
): Promise<T> {
  const token = await resolveAccessToken(accessToken);

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function getAcceptedTermsVersion(
  versionKey: string,
  accessToken?: string | null,
): Promise<string | null> {
  if (!versionKey.trim()) return null;

  try {
    const data = await legalFetch<LegalEstadoResponse>(
      `/api/legal/estado?version=${encodeURIComponent(versionKey.trim())}`,
      undefined,
      accessToken,
    );
    return data.accepted && data.version ? data.version : null;
  } catch (error) {
    console.error("legal estado lookup failed:", error);
    return null;
  }
}

export async function acceptTermsVersion(
  versionKey: string,
  accessToken?: string | null,
): Promise<{ version: string }> {
  const data = await legalFetch<{ success?: boolean; version?: string }>(
    "/api/legal/terminos",
    {
      method: "POST",
      body: JSON.stringify({ version: versionKey.trim() }),
    },
    accessToken,
  );

  if (!data.version) {
    throw new Error("No se pudo guardar la aceptación de términos.");
  }

  return { version: data.version };
}
