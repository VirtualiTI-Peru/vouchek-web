'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Organization = {
  id: string;
  name: string;
  code: string;
  ruc: string | null;
  is_active: boolean;
  created_at?: string;
};

export default function CustomersTable({
  organizations,
  canManage,
  onToggleStatus,
}: {
  organizations: Organization[];
  canManage: boolean;
  onToggleStatus: (org: Organization, nextActive: boolean) => void;
}) {
  return (
    <div className="rounded-md border border-default-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>RUC</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-default-500">
                No hay clientes.
              </TableCell>
            </TableRow>
          ) : (
            organizations.map((organization) => (
              <TableRow key={organization.id}>
                <TableCell className="font-mono text-xs">{organization.id}</TableCell>
                <TableCell>{organization.code ?? <span className="text-default-400">No establecido</span>}</TableCell>
                <TableCell>{organization.name}</TableCell>
                <TableCell>{organization.ruc ?? <span className="text-default-400">No establecido</span>}</TableCell>
                <TableCell>
                  <Badge color={organization.is_active ? 'success' : 'secondary'}>
                    {organization.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
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
