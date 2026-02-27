'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
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
};

export function WorkOrgFilter({ isSuperAdmin = false, organizations = [] }: WorkOrgFilterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCustomerId = useMemo(
    () => resolveWorkCustomerId(
      searchParams.get(WORK_CUSTOMER_ID_PARAM),
      organizations,
      organizations[0]?.id ?? '',
    ),
    [organizations, searchParams],
  );

  useEffect(() => {
    if (!isWorkDateRoute(pathname) || !isSuperAdmin || organizations.length === 0) {
      return;
    }

    const urlCustomerId = searchParams.get(WORK_CUSTOMER_ID_PARAM);
    const resolvedCustomerId = resolveWorkCustomerId(
      urlCustomerId,
      organizations,
      organizations[0]?.id ?? '',
    );

    if (urlCustomerId && organizations.some((organization) => organization.id === urlCustomerId)) {
      setStoredWorkCustomerId(resolvedCustomerId);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set(WORK_CUSTOMER_ID_PARAM, resolvedCustomerId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [isSuperAdmin, organizations, pathname, router, searchParams]);

  if (!isWorkDateRoute(pathname) || !isSuperAdmin || organizations.length === 0) {
    return null;
  }

  function handleOrganizationChange(nextCustomerId: string) {
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
        value={selectedCustomerId}
        onValueChange={handleOrganizationChange}
        disabled={organizations.length <= 1}
      >
        <SelectTrigger id="work-org-filter" className="min-w-[180px] h-8">
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
