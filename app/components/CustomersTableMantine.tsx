'use client';
import { Table, Button, Badge, Text } from '@mantine/core';

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
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>ID</Table.Th>
          <Table.Th>Código</Table.Th>
          <Table.Th>Nombre</Table.Th>
          <Table.Th>RUC</Table.Th>
          <Table.Th>Estado</Table.Th>
          <Table.Th>Acción</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {organizations.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={6} ta="center" py="xl" c="dimmed">
              No hay organizaciones.
            </Table.Td>
          </Table.Tr>
        ) : (
          organizations.map((organization) => (
            <Table.Tr key={organization.id}>
              <Table.Td>{organization.id}</Table.Td>
              <Table.Td>
                {organization.code ?? <Text c="dimmed">No establecido</Text>}
              </Table.Td>
              <Table.Td>{organization.name}</Table.Td>
              <Table.Td>
                {organization.ruc ?? <Text c="dimmed">No establecido</Text>}
              </Table.Td>
              <Table.Td>
                <Badge
                  color={organization.is_active ? 'green' : 'gray'}
                  variant="light"
                >
                  {organization.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </Table.Td>
              <Table.Td>
                {canManage ? (
                  <Button
                    size="xs"
                    variant="light"
                    color={organization.is_active ? 'orange' : 'green'}
                    onClick={() => onToggleStatus(organization, !organization.is_active)}
                  >
                    {organization.is_active ? 'Inactivar' : 'Activar'}
                  </Button>
                ) : (
                  <Text c="dimmed">-</Text>
                )}
              </Table.Td>
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );
}