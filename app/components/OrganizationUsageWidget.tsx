'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPlanDefinition, planUsedDisplay } from '@/lib/plans';
import type { OrganizationUsage } from '@/lib/organization-limits';

type Props = {
  usage: OrganizationUsage;
};

function planLabel(tier: string) {
  return getPlanDefinition(tier)?.label ?? String(tier);
}

export default function OrganizationUsageWidget({ usage }: Props) {
  const extras = usage.extraUsers > 0 || usage.extraReceipts > 0;

  return (
    <Card className="border-default-200">
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-default-500">Plan contratado</p>
            <p className="text-lg font-semibold text-default-900">{planLabel(usage.planTier)}</p>
          </div>
          <div className="flex items-center gap-2">
            {!usage.isActive ? (
              <Badge color="destructive">Inactivo</Badge>
            ) : extras && !usage.isTrial ? (
              <Badge color="warning">Con adicionales</Badge>
            ) : (
              <Badge color="secondary">Periodo {usage.periodKey}</Badge>
            )}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]" />
              <TableHead className="text-right">Plan</TableHead>
              <TableHead className="text-right">Adicionales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Usuarios</TableCell>
              <TableCell className="text-right tabular-nums">
                {planUsedDisplay(usage.usersReserved, usage.includedUsers)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {usage.extraUsers}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Comprobantes</TableCell>
              <TableCell className="text-right tabular-nums">
                {planUsedDisplay(usage.receiptsUsed, usage.includedReceiptsPerMonth)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {usage.extraReceipts}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {!usage.isTrial ? (
          <p className="text-xs text-default-500">
            * Usuarios y recibos adicionales serán incluidos en su próxima factura.
          </p>
        ) : (
          <p className="text-xs text-default-500">
            Periodo de prueba: al llegar al límite no se pueden agregar extras.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
