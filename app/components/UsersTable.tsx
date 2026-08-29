'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Mail, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  resolveWorkCustomerId,
  WORK_CUSTOMER_ID_PARAM,
} from '@/lib/work-org';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AVAILABLE_ROLES as ROLE_OPTIONS, VOUCHEK_ROLES, normalizeVouchekRole, type VouchekRoleSlug } from '@/lib/roles';
import ExtraSeatConfirmDialog from '@/components/extra-seat-confirm-dialog';
import { EXTRA_USER_PEN } from '@/lib/plans';
import type { OrganizationUsage } from '@/lib/organization-limits';

type Member = {
  id: string;
  profileId?: string;
  username?: string;
  email?: string;
  role?: string;
  status?: string;
  lastSignInAt?: string;
  firstName?: string;
  lastName?: string;
  isSuperAdmin?: boolean;
};

type Org = { id: string; name: string };

const AVAILABLE_ROLES = ROLE_OPTIONS.filter((r) =>
  r.value === VOUCHEK_ROLES.TRANSPORTISTA
  || r.value === VOUCHEK_ROLES.VERIFICADOR
  || r.value === VOUCHEK_ROLES.SYSADMIN,
);

function RoleSelect({
  value,
  onChange,
  disabled,
  className,
  roles = AVAILABLE_ROLES,
}: {
  value: string;
  onChange: (value: VouchekRoleSlug) => void;
  disabled?: boolean;
  className?: string;
  roles?: { value: VouchekRoleSlug; label: string }[];
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const normalized = normalizeVouchekRole(next);
        if (normalized) onChange(normalized);
      }}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? 'min-w-[220px]'}>
        <SelectValue placeholder="Seleccionar rol" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((availableRole) => (
          <SelectItem key={availableRole.value} value={availableRole.value}>
            {availableRole.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type CreateUserModalProps = {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onCompleted: () => void;
  onMessage: (message: string) => void;
};

function CreateUserModal({ open, orgId, onClose, onCompleted, onMessage }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<VouchekRoleSlug>(VOUCHEK_ROLES.TRANSPORTISTA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setRole(VOUCHEK_ROLES.TRANSPORTISTA);
    setError('');
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !firstName.trim() || !lastName.trim()) {
      setError('Todos los campos son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          orgId,
          role,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo crear el usuario.');
        return;
      }

      if (data?.emailSent === false) {
        onMessage(data?.emailError ?? 'Usuario creado, pero falló el correo de bienvenida.');
      } else if (data?.assignedExisting) {
        onMessage(data?.message ?? 'Usuario existente asignado. Se envió el correo de bienvenida.');
      } else {
        onMessage(data?.message ?? 'Usuario creado y correo de bienvenida enviado.');
      }
      onCompleted();
      resetForm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label htmlFor="create-firstName">Nombre</Label>
            <Input
              id="create-firstName"
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Nombre"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-lastName">Apellido</Label>
            <Input
              id="create-lastName"
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Apellido"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-email">Correo electrónico</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Correo electrónico"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <RoleSelect value={role} onChange={setRole} disabled={loading} className="w-full" />
          </div>
          <p className="text-xs text-muted-foreground">
            Se generará una contraseña temporal y se enviará por correo. El usuario podrá cambiarla después.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type EditUserModalProps = {
  open: boolean;
  member: Member | null;
  orgId: string;
  isSuperAdmin: boolean;
  onClose: () => void;
  onCompleted: () => void;
  onMessage: (message: string) => void;
};

function EditUserModal({
  open,
  member,
  orgId,
  isSuperAdmin,
  onClose,
  onCompleted,
  onMessage,
}: EditUserModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<VouchekRoleSlug>(VOUCHEK_ROLES.TRANSPORTISTA);
  const [isSuperAdminFlag, setIsSuperAdminFlag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !member) return;
    setFirstName(member.firstName ?? '');
    setLastName(member.lastName ?? '');
    const memberRole = normalizeVouchekRole(member.role) ?? VOUCHEK_ROLES.TRANSPORTISTA;
    setRole(
      AVAILABLE_ROLES.some((r) => r.value === memberRole) ? memberRole : VOUCHEK_ROLES.TRANSPORTISTA,
    );
    setIsSuperAdminFlag(member.isSuperAdmin === true);
    setError('');
  }, [open, member]);

  const handleClose = () => {
    if (loading) return;
    setError('');
    onClose();
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!member?.id) return;

    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Nombre y apellido son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.id,
          orgId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role,
          isSuperAdmin: isSuperAdminFlag,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo actualizar el usuario.');
        return;
      }

      onMessage(`Usuario ${member.email ?? member.username ?? ''} actualizado.`);
      onCompleted();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          {member?.email && (
            <div className="space-y-1">
              <Label>Correo electrónico</Label>
              <p className="rounded-md border border-default-200 bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
                {member.email}
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="edit-firstName">Nombre</Label>
            <Input
              id="edit-firstName"
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Nombre"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-lastName">Apellido</Label>
            <Input
              id="edit-lastName"
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Apellido"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <RoleSelect value={role} onChange={setRole} disabled={loading} className="w-full" />
          </div>
          {isSuperAdmin && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-isSuperAdmin"
                checked={isSuperAdminFlag}
                onCheckedChange={(checked) => setIsSuperAdminFlag(checked === true)}
                disabled={loading}
              />
              <Label htmlFor="edit-isSuperAdmin" className="cursor-pointer">
                Es Superadmin?
              </Label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersTable({
  organizations,
  isSuperAdmin = false,
  ownOrgId = '',
}: {
  organizations: Org[];
  isSuperAdmin?: boolean;
  ownOrgId?: string;
}) {
  const searchParams = useSearchParams();
  const selectedOrg = useMemo(() => {
    if (isSuperAdmin) {
      return resolveWorkCustomerId(
        searchParams.get(WORK_CUSTOMER_ID_PARAM),
        organizations,
        organizations[0]?.id ?? '',
      );
    }
    return ownOrgId.trim() || organizations[0]?.id || '';
  }, [isSuperAdmin, organizations, ownOrgId, searchParams]);

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [resettingUserId, setResettingUserId] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');
  const [membersMessage, setMembersMessage] = useState('');
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [extraConfirmOpen, setExtraConfirmOpen] = useState(false);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [editUserModal, setEditUserModal] = useState<{ open: boolean; member: Member | null }>({
    open: false,
    member: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; member: Member | null }>({
    open: false,
    member: null,
  });

  const loadMembers = async (orgId: string) => {
    setLoadingMembers(true);
    try {
      const [membersRes, usageRes] = await Promise.all([
        fetch(`/api/org-members?orgId=${orgId}`),
        fetch(`/api/organizations/${encodeURIComponent(orgId)}/usage`, { cache: 'no-store' }),
      ]);
      const data = await membersRes.json();
      if (Array.isArray(data)) {
        setMembers(data);
      } else {
        setMembers([]);
      }
      if (usageRes.ok) {
        setUsage((await usageRes.json()) as OrganizationUsage);
      } else {
        setUsage(null);
      }
    } catch (error) {
      console.error('Error loading members:', error);
      setMembers([]);
      setUsage(null);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (selectedOrg) {
      void loadMembers(selectedOrg);
    }
  }, [selectedOrg]);

  const handleResetPassword = async (member: Member) => {
    setMembersMessage('');
    if (!member.id || !member.email || !selectedOrg) {
      setMembersMessage('No se pudo preparar el restablecimiento de contraseña.');
      return;
    }

    if (!confirm(`¿Enviar email de restablecimiento de contraseña a ${member.email}?`)) {
      return;
    }

    setResettingUserId(member.id);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.id,
          profileId: member.profileId,
          orgId: selectedOrg,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMembersMessage(data?.error ?? 'No se pudo enviar el restablecimiento.');
        return;
      }

      setMembersMessage(
        data?.message
          ?? `Se envió un email para restablecer la contraseña a ${member.email}.`,
      );
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

  const filteredMembers = members.filter((member: Member) => {
    if (isSuperAdmin) return true;
    if (member.isSuperAdmin === true) return false;
    if (member.role && member.role.toLowerCase() === 'superadmin') return false;
    return true;
  });

  const selectedOrgName =
    organizations.find((org) => org.id === selectedOrg)?.name ?? selectedOrg;

  const usedUsers = Math.max(filteredMembers.length, usage?.usersReserved ?? 0);
  const atHardCap =
    usage?.isTrial === true
    && usage.maxUsers != null
    && usedUsers >= usage.maxUsers;
  const willAddExtraUser =
    usage != null && !usage.isTrial && usedUsers >= usage.includedUsers;

  const requestCreateUser = () => {
    if (!selectedOrg || atHardCap) return;
    if (willAddExtraUser) {
      setExtraConfirmOpen(true);
      return;
    }
    setCreateUserModalOpen(true);
  };

  return (
    <>
      <p className="mb-4 text-sm text-default-500">
        Empresa activa: <span className="font-medium text-default-900">{selectedOrgName || '—'}</span>
        {isSuperAdmin ? ' (cámbiala en el selector del encabezado).' : null}
      </p>

      {membersMessage && (
        <Alert color="info" variant="soft" className="mb-4">
          <AlertDescription>{membersMessage}</AlertDescription>
        </Alert>
      )}

      {atHardCap && usage ? (
        <Alert color="warning" variant="soft" className="mb-4">
          <AlertDescription>
            Se alcanzó el límite de usuarios del periodo de prueba ({usedUsers} de {usage.maxUsers}).
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {usage ? (
          <p className="text-xs text-default-500">
            {usedUsers} usuarios · {Math.min(usedUsers, usage.includedUsers)} incluidos · {Math.max(0, usedUsers - usage.includedUsers)} adicionales
            {usage.planTier ? ` (plan ${usage.planTier})` : ''}
          </p>
        ) : (
          <span />
        )}
        <Button onClick={requestCreateUser} disabled={!selectedOrg || atHardCap}>
          Crear Usuario
        </Button>
      </div>

      <div className="rounded-md border border-default-200 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Correo Electrónico</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último Acceso</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingMembers ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-default-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando usuarios...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-default-500">
                  No se encontraron usuarios.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.username}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>
                    {member.status ?? (
                      <span className="text-default-500">Desconocido</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.lastSignInAt ? (
                      new Date(member.lastSignInAt).toLocaleString()
                    ) : (
                      <span className="text-default-500">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => setEditUserModal({ open: true, member })}
                        disabled={
                          resettingUserId === member.id || deletingUserId === member.id
                        }
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="soft"
                        color="primary"
                        onClick={() => void handleResetPassword(member)}
                        disabled={
                          resettingUserId === member.id || deletingUserId === member.id
                        }
                      >
                        {resettingUserId === member.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="mr-1 h-3.5 w-3.5" />
                        )}
                        Restablecer
                      </Button>
                      <Button
                        size="sm"
                        variant="soft"
                        color="destructive"
                        onClick={() => void handleDeleteUser(member)}
                        disabled={
                          deletingUserId === member.id || resettingUserId === member.id
                        }
                      >
                        {deletingUserId === member.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                        )}
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditUserModal
        open={editUserModal.open}
        member={editUserModal.member}
        orgId={selectedOrg}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setEditUserModal({ open: false, member: null })}
        onCompleted={() => {
          if (selectedOrg) {
            void loadMembers(selectedOrg);
          }
        }}
        onMessage={(message) => setMembersMessage(message)}
      />

      <CreateUserModal
        open={createUserModalOpen}
        orgId={selectedOrg}
        onClose={() => setCreateUserModalOpen(false)}
        onCompleted={() => {
          if (selectedOrg) {
            void loadMembers(selectedOrg);
          }
        }}
        onMessage={(message) => setMembersMessage(message)}
      />

      <ExtraSeatConfirmDialog
        open={extraConfirmOpen}
        onOpenChange={setExtraConfirmOpen}
        title="Usuario adicional"
        description={`Este usuario se sumará a la próxima factura (S/ ${EXTRA_USER_PEN} + IGV).`}
        onAccept={() => setCreateUserModalOpen(true)}
      />

      <AlertDialog
        open={deleteModal.open}
        onOpenChange={(open) => !open && setDeleteModal({ open: false, member: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará al usuario {deleteModal.member?.email}. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeleteUser()}
              disabled={deletingUserId === deleteModal.member?.id}
            >
              {deletingUserId === deleteModal.member?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
