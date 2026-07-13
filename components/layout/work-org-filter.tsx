'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  clearStoredWorkCustomerId,
  resolveWorkCustomerId,
  setStoredWorkCustomerId,
  WORK_CUSTOMER_ID_PARAM,
  type PortalOrganization,
} from '@/lib/work-org';
import { isWorkDateRoute } from '@/lib/work-date';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type WorkOrgFilterProps = {
  isSuperAdmin?: boolean;
  organizations?: PortalOrganization[];
  /** Home org for non-superadmin (JWT org_id). */
  ownOrgId?: string;
};

export function WorkOrgFilter({
  isSuperAdmin = false,
  organizations = [],
  ownOrgId = '',
}: WorkOrgFilterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canSwitchOrganization = isSuperAdmin && organizations.length > 1;

  const fallbackCustomerId = isSuperAdmin
    ? (organizations[0]?.id ?? '')
    : (ownOrgId || organizations[0]?.id || '');

  const selectedCustomerId = useMemo(
    () => resolveWorkCustomerId(
      isSuperAdmin ? searchParams.get(WORK_CUSTOMER_ID_PARAM) : null,
      organizations,
      fallbackCustomerId,
    ),
    [fallbackCustomerId, isSuperAdmin, organizations, searchParams],
  );

  useEffect(() => {
    if (!isWorkDateRoute(pathname)) {
      return;
    }

    if (!isSuperAdmin) {
      // Non-switchers must never keep another org id in the URL/storage.
      const urlCustomerId = searchParams.get(WORK_CUSTOMER_ID_PARAM)?.trim() ?? '';
      const homeOrgId = fallbackCustomerId;
      if (!homeOrgId) {
        return;
      }

      if (urlCustomerId && urlCustomerId !== homeOrgId) {
        clearStoredWorkCustomerId();
      }
      setStoredWorkCustomerId(homeOrgId);

      if (urlCustomerId === homeOrgId) {
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      params.set(WORK_CUSTOMER_ID_PARAM, homeOrgId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }

    if (organizations.length === 0) {
      return;
    }

    const urlCustomerId = searchParams.get(WORK_CUSTOMER_ID_PARAM);
    const resolvedCustomerId = resolveWorkCustomerId(
      urlCustomerId,
      organizations,
      organizations[0]?.id ?? '',
    );

    if (!resolvedCustomerId) {
      return;
    }

    if (urlCustomerId && organizations.some((organization) => organization.id === urlCustomerId)) {
      setStoredWorkCustomerId(resolvedCustomerId);
      return;
    }

    setStoredWorkCustomerId(resolvedCustomerId);
    const params = new URLSearchParams(searchParams.toString());
    params.set(WORK_CUSTOMER_ID_PARAM, resolvedCustomerId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [fallbackCustomerId, isSuperAdmin, organizations, pathname, router, searchParams]);

  if (!isWorkDateRoute(pathname) || organizations.length === 0) {
    return null;
  }

  function handleOrganizationChange(nextCustomerId: string) {
    if (!canSwitchOrganization) return;

    setStoredWorkCustomerId(nextCustomerId);

    const params = new URLSearchParams(searchParams.toString());
    params.set(WORK_CUSTOMER_ID_PARAM, nextCustomerId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="work-org-filter" className="hidden md:inline text-sm text-default-600 whitespace-nowrap">
        Empresa
      </Label>
      <Select
        value={selectedCustomerId || organizations[0]?.id}
        onValueChange={handleOrganizationChange}
        disabled={!canSwitchOrganization}
      >
        <SelectTrigger
          id="work-org-filter"
          className="min-w-[180px] h-8"
          aria-readonly={!canSwitchOrganization}
        >
          <SelectValue placeholder="Seleccionar empresa" />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((organization) => (
            <SelectItem key={organization.id} value={organization.id}>
              {organization.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
