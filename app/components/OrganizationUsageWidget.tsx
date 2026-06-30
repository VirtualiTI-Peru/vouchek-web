'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PLAN_TIER_OPTIONS } from '@/lib/plans';
import type { OrganizationUsage } from '@/lib/organization-limits';
import type { PlanTier } from '@/lib/plans';

type Props = {
  usage: OrganizationUsage;
};

function planLabel(tier: PlanTier) {
  return PLAN_TIER_OPTIONS.find((p) => p.value === tier)?.label ?? tier;
}

function usagePercent(used: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function barColor(percent: number) {
  if (percent >= 100) return 'bg-destructive';
  if (percent >= 85) return 'bg-warning';
  return 'bg-primary';
}

function UsageMeter({
  label,
  used,
  max,
  hint,
}: {
  label: string;
  used: number;
  max: number;
  hint?: string;
}) {
  const percent = usagePercent(used, max);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-default-600">{label}</span>
        <span className="font-medium tabular-nums text-default-900">
          {used}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-default-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor(percent)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {hint ? <p className="text-xs text-default-500">{hint}</p> : null}
    </div>
  );
}

export default function OrganizationUsageWidget({ usage }: Props) {
  const usersHint =
    usage.pendingInvites > 0
      ? `${usage.pendingInvites} invitación(es) pendiente(s) incluidas en el cupo.`
      : undefined;

  const receiptsHint =
    usage.allowReceiptOverage
      ? 'Overage habilitado: los excedentes pueden generar cargo adicional.'
      : usage.receiptsRemaining <= 0
        ? 'Límite mensual alcanzado. Los transportistas no podrán subir más comprobantes.'
        : undefined;

  return (
    <Card className="border-default-200">
      <CardContent className="pt-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-default-500">Plan contratado</p>
            <p className="text-lg font-semibold text-default-900">{planLabel(usage.planTier)}</p>
          </div>
          <div className="flex items-center gap-2">
            {!usage.isActive ? (
              <Badge color="destructive">Inactivo</Badge>
            ) : usage.receiptsRemaining <= 0 && !usage.allowReceiptOverage ? (
              <Badge color="warning">Cupo agotado</Badge>
            ) : (
              <Badge color="secondary">Periodo {usage.periodKey}</Badge>
            )}
          </div>
        </div>

        <div className="grid gap-5">
          <UsageMeter
            label="Usuarios"
            used={usage.usersReserved}
            max={usage.maxUsers}
            hint={usersHint}
          />
          <UsageMeter
            label="Comprobantes este mes"
            used={usage.receiptsUsed}
            max={usage.maxReceiptsPerMonth}
            hint={receiptsHint}
          />
        </div>
      </CardContent>
    </Card>
  );
}
