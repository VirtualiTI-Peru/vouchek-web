'use client';
import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Select,
  Tabs,
  Alert,
  Loader,
  Group,
  ActionIcon,
  Text,
  Modal,
} from '@mantine/core';
import { IconRefresh, IconTrash, IconMail } from '@tabler/icons-react';

type Member = {
  id: string;
  username?: string;
  email?: string;
  role?: string;
  status?: string;
  lastSignInAt?: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

type Org = { id: string; name: string };

export default function UsersTable({
  organizations,
  showOrganizationSelector = true,
  isSuperAdmin = false,
}: {
  organizations: Org[];
  showOrganizationSelector?: boolean;
  isSuperAdmin?: boolean;
}) {
  const [selectedOrg, setSelectedOrg] = useState(organizations[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [resettingUserId, setResettingUserId] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');
  const [membersMessage, setMembersMessage] = useState('');
  const [invitationMessage, setInvitationMessage] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; member: Member | null }>({
    open: false,
    member: null,
  });

  const loadMembers = async (orgId: string) => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/org-members?orgId=${orgId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMembers(data);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error('Error loading members:', error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadInvitations = async (orgId: string) => {
    setLoadingInvitations(true);
    try {
      const res = await fetch(`/api/invitations?orgId=${orgId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setInvitations(data);
      } else {
        setInvitations([]);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      setInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  };

  useEffect(() => {
    if (selectedOrg) {
      void loadMembers(selectedOrg);
      void loadInvitations(selectedOrg);
    }
  }, [selectedOrg]);

  const handleResetPassword = async (member: Member) => {
    setMembersMessage('');
    if (!member.id || !member.email) {
      setMembersMessage('No se pudo preparar el restablecimiento de contraseña.');
      return;
    }

    setResettingUserId(member.id);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMembersMessage(data?.error ?? 'No se pudo reenviar el correo.');
        return;
      }

      setMembersMessage(`Se envió un nuevo enlace de configuración a ${member.email}.`);
    } finally {
      setResettingUserId('');
    }
  };

  const handleDeleteUser = async (member: Member) => {
    setMembersMessage('');
    if (!member.id || !member.email || !selectedOrg) {
      setMembersMessage('No se pudo preparar la eliminación del usuario.');
      return;
    }

    setDeleteModal({ open: true, member });
  };

  const confirmDeleteUser = async () => {
    const member = deleteModal.member;
    if (!member) return;

    setDeleteModal({ open: false, member: null });
    setDeletingUserId(member.id);

    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, orgId: selectedOrg }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMembersMessage(data?.error ?? 'No se pudo eliminar el usuario.');
        return;
      }

      setMembersMessage(`Usuario ${member.email} eliminado.`);
      await loadMembers(selectedOrg);
    } finally {
      setDeletingUserId('');
    }
  };

  const filteredMembers = members.filter((member: any) => {
    if (isSuperAdmin) return true;
    if ((member as any).is_super_admin === true) return false;
    if (member.role && member.role.toLowerCase() === 'superadmin') return false;
    return true;
  });

  return (
    <>
      {showOrganizationSelector && (
        <Group mb="md">
          <Select
            data={organizations.map((org) => ({ value: org.id, label: org.name }))}
            value={selectedOrg}
            onChange={(value) => value && setSelectedOrg(value)}
            disabled={organizations.length <= 1}
            placeholder="Seleccionar organización"
            style={{ minWidth: 200 }}
          />
        </Group>
      )}

      {membersMessage && (
        <Alert color="blue" mb="md">
          {membersMessage}
        </Alert>
      )}

      {invitationMessage && (
        <Alert color="green" mb="md">
          {invitationMessage}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as 'users' | 'invitations')}>
        <Tabs.List>
          <Tabs.Tab value="users">Usuarios</Tabs.Tab>
          <Tabs.Tab value="invitations">Invitaciones</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="users" pt="md">
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Usuario</Table.Th>
                <Table.Th>Correo Electrónico</Table.Th>
                <Table.Th>Rol</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Último Acceso</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loadingMembers ? (
                <Table.Tr>
                  <Table.Td colSpan={6} ta="center" py="xl">
                    <Group justify="center">
                      <Loader size="sm" />
                      <Text>Cargando usuarios...</Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ) : filteredMembers.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} ta="center" py="xl" c="dimmed">
                    No se encontraron usuarios.
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredMembers.map((member) => (
                  <Table.Tr key={member.id}>
                    <Table.Td>{member.username}</Table.Td>
                    <Table.Td>{member.email}</Table.Td>
                    <Table.Td>{member.role}</Table.Td>
                    <Table.Td>{member.status ?? <Text c="dimmed">Desconocido</Text>}</Table.Td>
                    <Table.Td>
                      {member.lastSignInAt ? (
                        new Date(member.lastSignInAt).toLocaleString()
                      ) : (
                        <Text c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconMail size={14} />}
                          onClick={() => void handleResetPassword(member)}
                          disabled={resettingUserId === member.id || deletingUserId === member.id}
                          loading={resettingUserId === member.id}
                        >
                          Restablecer
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => void handleDeleteUser(member)}
                          disabled={deletingUserId === member.id || resettingUserId === member.id}
                          loading={deletingUserId === member.id}
                        >
                          Eliminar
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="invitations" pt="md">
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Correo Electrónico</Table.Th>
                <Table.Th>Rol</Table.Th>
                <Table.Th>Fecha de Creación</Table.Th>
                <Table.Th>Expira</Table.Th>
                <Table.Th>Estado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loadingInvitations ? (
                <Table.Tr>
                  <Table.Td colSpan={5} ta="center" py="xl">
                    <Group justify="center">
                      <Loader size="sm" />
                      <Text>Cargando invitaciones...</Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ) : invitations.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5} ta="center" py="xl" c="dimmed">
                    No se encontraron invitaciones.
                  </Table.Td>
                </Table.Tr>
              ) : (
                invitations.map((invitation) => (
                  <Table.Tr key={invitation.id}>
                    <Table.Td>{invitation.email}</Table.Td>
                    <Table.Td>{invitation.role}</Table.Td>
                    <Table.Td>{new Date(invitation.created_at).toLocaleString()}</Table.Td>
                    <Table.Td>{new Date(invitation.expires_at).toLocaleString()}</Table.Td>
                    <Table.Td>
                      {invitation.accepted_at ? (
                        <Text c="green">Aceptada</Text>
                      ) : (
                        <Text c="orange">Pendiente</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, member: null })}
        title="Confirmar eliminación"
        centered
      >
        <Text>
          Esta acción eliminará al usuario {deleteModal.member?.email}. ¿Deseas continuar?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => setDeleteModal({ open: false, member: null })}
          >
            Cancelar
          </Button>
          <Button
            color="red"
            onClick={confirmDeleteUser}
            loading={deletingUserId === deleteModal.member?.id}
          >
            Eliminar
          </Button>
        </Group>
      </Modal>
    </>
  );
}