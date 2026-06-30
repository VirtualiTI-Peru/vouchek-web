'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Gauge, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import OrganizationUsageWidget from '@/app/components/OrganizationUsageWidget';
import { cn } from '@/lib/utils';
import { resolveWorkCustomerId, WORK_CUSTOMER_ID_PARAM, type PortalOrganization } from '@/lib/work-org';
import type { OrganizationUsage } from '@/lib/organization-limits';

type QuotaButtonProps = {
  ownOrgId?: string;
  isSuperAdmin?: boolean;
  organizations?: PortalOrganization[];
};

function receiptsUsagePercent(usage: OrganizationUsage | null): number {
  if (!usage || usage.maxReceiptsPerMonth <= 0) return 0;
  return Math.round((usage.receiptsUsed / usage.maxReceiptsPerMonth) * 100);
}

function indicatorColor(percent: number): string | null {
  if (percent >= 100) return 'bg-red-500';
  if (percent >= 85) return 'bg-orange-500';
  if (percent >= 75) return 'bg-yellow-400';
  return null;
}

export function QuotaButton({
  ownOrgId = '',
  isSuperAdmin = false,
  organizations = [],
}: QuotaButtonProps) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);

  const activeOrgId = useMemo(() => {
    if (isSuperAdmin) {
      return resolveWorkCustomerId(
        searchParams.get(WORK_CUSTOMER_ID_PARAM),
        organizations,
        organizations[0]?.id ?? '',
      );
    }
    return ownOrgId;
  }, [isSuperAdmin, organizations, ownOrgId, searchParams]);

  useEffect(() => {
    if (!activeOrgId) {
      setUsage(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/organizations/${encodeURIComponent(activeOrgId)}/usage`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? 'No se pudo cargar el uso del plan.');
        }
        if (!cancelled) setUsage(data as OrganizationUsage);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Refresca al cambiar de empresa y cada vez que se abre el modal.
  }, [activeOrgId, open]);

  const percent = receiptsUsagePercent(usage);
  const dotColor = indicatorColor(percent);

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="relative md:bg-secondary bg-transparent text-secondary-foreground md:h-8 md:w-8 h-auto w-auto"
        onClick={() => setOpen(true)}
        title={dotColor ? `Uso de recibos: ${percent}%` : 'Uso del plan'}
        aria-label={dotColor ? `Uso del plan, recibos al ${percent}%` : 'Uso del plan'}
      >
        <Gauge className="h-[1.2rem] w-[1.2rem]" />
        {dotColor ? (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-header',
              dotColor,
            )}
          />
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>Uso del plan</DialogTitle>
          </DialogHeader>

          {!activeOrgId ? (
            <p className="py-6 text-center text-sm text-default-500">
              Selecciona una empresa para ver su uso.
            </p>
          ) : loading && !usage ? (
            <div className="flex items-center justify-center gap-2 py-10 text-default-600">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Cargando uso...</span>
            </div>
          ) : error && !usage ? (
            <p className="py-6 text-center text-sm text-destructive">{error}</p>
          ) : usage ? (
            <OrganizationUsageWidget usage={usage} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
