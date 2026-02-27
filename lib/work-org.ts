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

export function resolveWorkCustomerId(
  customerIdParam: string | null | undefined,
  organizations: PortalOrganization[],
  fallbackCustomerId: string,
): string {
  const organizationIds = new Set(organizations.map((organization) => organization.id));

  if (customerIdParam && organizationIds.has(customerIdParam)) {
    return customerIdParam;
  }

  const storedCustomerId = getStoredWorkCustomerId();
  if (storedCustomerId && organizationIds.has(storedCustomerId)) {
    return storedCustomerId;
  }

  if (fallbackCustomerId && organizationIds.has(fallbackCustomerId)) {
    return fallbackCustomerId;
  }

  return organizations[0]?.id ?? '';
}
