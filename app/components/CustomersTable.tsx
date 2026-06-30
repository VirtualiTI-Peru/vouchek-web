'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PLAN_TIER_OPTIONS } from '@/lib/plans';
import type { OrganizationUsage } from '@/lib/organization-limits';
import type { PlanTier } from '@/lib/plans';

export type OrganizationWithUsage = {
  id: string;
  name: string;
  code: string;
  ruc: string | null;
  is_active: boolean;
  created_at?: string;
  plan_tier: PlanTier;
  max_users: number;
  max_receipts_per_month: number;
  extra_users: number;
  extra_receipts: number;
  allow_receipt_overage: boolean;
  monthly_fee_pen: number | null;
  demo_enabled: boolean;
  demo_days: number | null;
  subscription_ends_at?: string | null;
  usage?: OrganizationUsage | null;
};

function planLabel(tier: PlanTier) {
  return PLAN_TIER_OPTIONS.find((p) => p.value === tier)?.label ?? tier;
}

function demoDaysRemaining(endsAt?: string | null): number | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}

function usageUsersText(usage?: OrganizationUsage | null) {
  if (!usage) return '—';
  return `${usage.usersReserved}/${usage.maxUsers}`;
}

function usageReceiptsText(usage?: OrganizationUsage | null) {
  if (!usage) return '—';
  return `${usage.receiptsUsed}/${usage.maxReceiptsPerMonth}`;
}

export default function CustomersTable({
  organizations,
  canManage,
  onToggleStatus,
  onPlanChange,
  onDemoChange,
}: {
  organizations: OrganizationWithUsage[];
  canManage: boolean;
  onToggleStatus: (org: OrganizationWithUsage, nextActive: boolean) => void;
  onPlanChange: (org: OrganizationWithUsage, planTier: PlanTier) => void;
  onDemoChange?: (org: OrganizationWithUsage) => void;
}) {
  return (
    <div className="rounded-md border border-default-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Usuarios</TableHead>
            <TableHead>Comprobantes/mes</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Demo</TableHead>
            <TableHead>Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-default-500">
                No hay clientes.
              </TableCell>
            </TableRow>
          ) : (
            organizations.map((organization) => (
              <TableRow key={organization.id}>
                <TableCell>{organization.code ?? <span className="text-default-400">—</span>}</TableCell>
                <TableCell>{organization.name}</TableCell>
                <TableCell>
                  {canManage ? (
                    <select
                      className="h-9 rounded-md border border-default-200 bg-white px-2 text-sm dark:bg-card"
                      value={organization.plan_tier}
                      onChange={(e) => onPlanChange(organization, e.target.value as PlanTier)}
                    >
                      {PLAN_TIER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    planLabel(organization.plan_tier)
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{usageUsersText(organization.usage)}</TableCell>
                <TableCell className="tabular-nums">{usageReceiptsText(organization.usage)}</TableCell>
                <TableCell>
                  <Badge color={organization.is_active ? 'success' : 'secondary'}>
                    {organization.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {(() => {
                    if (!organization.demo_enabled) {
                      return canManage && onDemoChange ? (
                        <Button size="sm" variant="outline" onClick={() => onDemoChange(organization)}>
                          Activar demo
                        </Button>
                      ) : (
                        <span className="text-default-400">—</span>
                      );
                    }
                    const remaining = demoDaysRemaining(organization.subscription_ends_at);
                    const expired = remaining !== null && remaining <= 0;
                    return (
                      <div className="flex items-center gap-2">
                        <Badge color={expired ? 'destructive' : 'warning'}>
                          {expired
                            ? 'Demo vencido'
                            : remaining !== null
                              ? `Demo · ${remaining}d`
                              : 'Demo'}
                        </Badge>
                        {canManage && onDemoChange && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDemoChange(organization)}
                          >
                            Editar
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className={organization.is_active ? 'text-amber-700 border-amber-300' : 'text-emerald-700 border-emerald-300'}
                      onClick={() => onToggleStatus(organization, !organization.is_active)}
                    >
                      {organization.is_active ? 'Inactivar' : 'Activar'}
                    </Button>
                  ) : (
                    <span className="text-default-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
