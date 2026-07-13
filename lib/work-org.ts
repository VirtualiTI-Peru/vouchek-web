export const WORK_CUSTOMER_ID_PARAM = 'customerId';
const WORK_CUSTOMER_ID_STORAGE_KEY = 'vouchek.workCustomerId';

export type PortalOrganization = {
  id: string;
  name: string;
};

export function getStoredWorkCustomerId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const customerId = sessionStorage.getItem(WORK_CUSTOMER_ID_STORAGE_KEY);
    return customerId?.trim() || null;
  } catch {
    return null;
  }
}

export function setStoredWorkCustomerId(customerId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(WORK_CUSTOMER_ID_STORAGE_KEY, customerId);
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
}

export function clearStoredWorkCustomerId(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(WORK_CUSTOMER_ID_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Resolve the active work organization.
 * Prefer URL → sessionStorage → fallback, but only IDs that belong to `organizations`.
 * When the org list is empty (transient load failure), keep using `fallbackCustomerId`.
 */
export function resolveWorkCustomerId(
  customerIdParam: string | null | undefined,
  organizations: PortalOrganization[],
  fallbackCustomerId: string,
): string {
  const trimmedFallback = fallbackCustomerId.trim();
  const organizationIds = new Set(organizations.map((organization) => organization.id));

  if (customerIdParam && organizationIds.has(customerIdParam)) {
    return customerIdParam;
  }

  const storedCustomerId = getStoredWorkCustomerId();
  if (storedCustomerId && organizationIds.has(storedCustomerId)) {
    return storedCustomerId;
  }

  if (trimmedFallback) {
    if (organizations.length === 0 || organizationIds.has(trimmedFallback)) {
      return trimmedFallback;
    }
  }

  return organizations[0]?.id ?? trimmedFallback;
}
