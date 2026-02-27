'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail, Pencil, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

type Member = {
  id: string;
  username?: string;
  email?: string;
  role?: string;
  status?: string;
  lastSignInAt?: string;
  firstName?: string;
  lastName?: string;
  isSuperAdmin?: boolean;
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

type BulkUserRow = {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  role?: string;
};

type BulkCreateSummary = {
  total: number;
  created: number;
  failed: number;
  emailSent: number;
  emailFailed: number;
};

type BulkCreateResultRow = {
  row: number;
  email: string;
  role?: string;
  success: boolean;
  emailSent: boolean;
  generatedPassword?: string;
  error?: string;
};

const AVAILABLE_ROLES = [
  { value: 'org:transportista', label: 'Transportista' },
  { value: 'org:sistema', label: 'Administrador del Sistema' },
  { value: 'org:verificador', label: 'Verificador' },
];

function RoleSelect({
  value,
  onChange,
  disabled,
  className,
  roles = AVAILABLE_ROLES,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  roles?: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
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

type InviteFormProps = {
  orgId: string;
  members: Member[];
  onInvited: () => void;
};

function InviteForm({ orgId, members, onInvited }: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('org:transportista');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleInvite = async () => {
    setMessage('');
    if (!email || !orgId) return;

    const normalizedEmail = email.trim().toLowerCase();
    const exists = members.some((member) => (member.email ?? '').toLowerCase() === normalizedEmail);
    if (exists) {
      setMessage('El usuario ya existe en la empresa.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, orgId, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage('Invitación enviada.');
        setEmail('');
        onInvited();
      } else {
        setMessage(data?.error || 'Error al enviar la invitación');
      }
    } catch {
      setMessage('Error al enviar la invitación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1 space-y-1">
        <Label htmlFor="invite-email">Correo electrónico</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
          placeholder="Correo electrónico"
        />
      </div>
      <div className="space-y-1">
        <Label>Rol</Label>
        <RoleSelect value={role} onChange={setRole} disabled={loading} />
      </div>
      <Button onClick={() => void handleInvite()} disabled={loading || !email || !orgId}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? 'Enviando...' : 'Enviar invitación'}
      </Button>
      {message && <p className="w-full text-sm text-default-600">{message}</p>}
    </div>
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('org:transportista');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPassword('');
    setConfirmPassword('');
    setRole('org:transportista');
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
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
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
          password,
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
      } else {
        onMessage('Usuario creado y correo de bienvenida enviado.');
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
            <Label htmlFor="create-password">Contraseña</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-confirmPassword">Confirmar contraseña</Label>
            <Input
              id="create-confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirmar contraseña"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <RoleSelect value={role} onChange={setRole} disabled={loading} className="w-full" />
          </div>

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
  const [role, setRole] = useState('org:transportista');
  const [isSuperAdminFlag, setIsSuperAdminFlag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !member) return;
    setFirstName(member.firstName ?? '');
    setLastName(member.lastName ?? '');
    const memberRole = member.role ?? 'org:transportista';
    setRole(
      AVAILABLE_ROLES.some((r) => r.value === memberRole) ? memberRole : 'org:transportista',
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
              <Input value={member.email} disabled />
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

type BulkCreateModalProps = {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onCompleted: () => void;
  onMessage: (message: string) => void;
};

function getFieldValue(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    if (row[alias] != null) {
      return String(row[alias]).trim();
    }
  }
  return '';
}

async function parseCsvUsers(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return [] as BulkUserRow[];
  }

  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rows.map((row) => ({
    email: getFieldValue(row, ['email', 'correo']),
    firstName: getFieldValue(row, ['first_name', 'first', 'firstname', 'nombre']),
    lastName: getFieldValue(row, ['last_name', 'last', 'lastname', 'apellido']),
    password: getFieldValue(row, ['password', 'contraseña']),
    role: getFieldValue(row, ['role', 'rol']),
  }));
}

function BulkCreateModal({ open, orgId, onClose, onCompleted, onMessage }: BulkCreateModalProps) {
  const [role, setRole] = useState('org:transportista');
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);
  const [rows, setRows] = useState<BulkUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creationCompleted, setCreationCompleted] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<BulkCreateSummary | null>(null);
  const [results, setResults] = useState<BulkCreateResultRow[]>([]);

  const resetForm = () => {
    setRole('org:transportista');
    setAutoGeneratePassword(true);
    setRows([]);
    setCreationCompleted(false);
    setError('');
    setSummary(null);
    setResults([]);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError('');
    setCreationCompleted(false);
    setSummary(null);
    setResults([]);

    if (!file) {
      setRows([]);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Solo se permite archivo CSV.');
      setRows([]);
      return;
    }

    try {
      const parsedRows = await parseCsvUsers(file);
      if (parsedRows.length === 0) {
        setError('El archivo no contiene filas.');
      }
      setRows(parsedRows);
    } catch {
      setError('No se pudo leer el archivo CSV.');
      setRows([]);
    }
  };

  const downloadTemplate = () => {
    const content = 'email,first_name,last_name,password,role\nusuario@correo.com,Nombre,Apellido,,org:transportista';
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla-usuarios.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBulkCreate = async () => {
    setError('');
    if (rows.length === 0) {
      setError('Selecciona un CSV con al menos una fila.');
      return;
    }

    setLoading(true);
    try {
      const payloadRows = rows
        .map((row) => ({
          email: row.email.trim().toLowerCase(),
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          password: row.password?.trim(),
          role: row.role?.trim() || role,
        }))
        .filter((row) => row.email || row.firstName || row.lastName || row.password || row.role);

      const res = await fetch('/api/users/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          role,
          autoGeneratePassword,
          users: payloadRows,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo completar la carga masiva.');
        return;
      }

      setSummary(data?.summary ?? null);
      setResults(Array.isArray(data?.results) ? data.results : []);
      setCreationCompleted(true);
      onMessage('Carga masiva finalizada. Revisa el resumen y resultados.');
      onCompleted();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Carga Masiva CSV</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-default-600">
            Columnas esperadas: email, first_name, last_name, password (opcional), role (opcional)
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              Descargar plantilla
            </Button>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={loading}
              className="max-w-xs"
            />
          </div>

          <div className="space-y-1">
            <Label>Rol predeterminado</Label>
            <RoleSelect value={role} onChange={setRole} disabled={loading} className="w-full" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-generate-password"
              checked={autoGeneratePassword}
              onCheckedChange={(checked) => setAutoGeneratePassword(checked === true)}
              disabled={loading}
            />
            <Label htmlFor="auto-generate-password" className="font-normal">
              Autogenerar contraseña para filas sin contraseña
            </Label>
          </div>

          <p className="text-sm text-default-600">Filas detectadas: {rows.length}</p>

          {rows.length > 0 && (
            <div className="rounded-md border border-default-200 bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Correo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Apellido</TableHead>
                    <TableHead>Contraseña</TableHead>
                    <TableHead>Rol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 5).map((row, index) => (
                    <TableRow key={`${row.email}-${index}`}>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.firstName}</TableCell>
                      <TableCell>{row.lastName}</TableCell>
                      <TableCell>{row.password ? 'Provisto' : '-'}</TableCell>
                      <TableCell>{row.role || role}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {summary && (
            <Alert color="info" variant="soft">
              <AlertDescription>
                Total: {summary.total} | Creados: {summary.created} | Fallidos: {summary.failed} |
                Correos enviados: {summary.emailSent} | Correos fallidos: {summary.emailFailed}
              </AlertDescription>
            </Alert>
          )}

          {results.length > 0 && (
            <div className="rounded-md border border-default-200 bg-card max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fila</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Correo enviado</TableHead>
                    <TableHead>Contraseña generada</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={`${result.row}-${result.email}`}>
                      <TableCell>{result.row}</TableCell>
                      <TableCell>{result.email}</TableCell>
                      <TableCell>{result.role ?? '-'}</TableCell>
                      <TableCell>{result.success ? 'Creado' : 'Error'}</TableCell>
                      <TableCell>{result.emailSent ? 'Enviado' : 'No enviado'}</TableCell>
                      <TableCell>{result.generatedPassword ?? '-'}</TableCell>
                      <TableCell>{result.error ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cerrar
            </Button>
            <Button
              onClick={() => void handleBulkCreate()}
              disabled={rows.length === 0 || creationCompleted || loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear usuarios
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [bulkCreateModalOpen, setBulkCreateModalOpen] = useState(false);
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
        body: JSON.stringify({ userId: member.id, orgId: selectedOrg }),
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

  const filteredMembers = members.filter((member: Member) => {
    if (isSuperAdmin) return true;
    if (member.isSuperAdmin === true) return false;
    if (member.role && member.role.toLowerCase() === 'superadmin') return false;
    return true;
  });

  return (
    <>
      {showOrganizationSelector && (
        <div className="mb-4">
          <Select
            value={selectedOrg}
            onValueChange={setSelectedOrg}
            disabled={organizations.length <= 1}
          >
            <SelectTrigger className="min-w-[200px]">
              <SelectValue placeholder="Seleccionar empresa" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {membersMessage && (
        <Alert color="info" variant="soft" className="mb-4">
          <AlertDescription>{membersMessage}</AlertDescription>
        </Alert>
      )}

      {invitationMessage && (
        <Alert color="success" variant="soft" className="mb-4">
          <AlertDescription>{invitationMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'users' | 'invitations')}>
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="pt-4">
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            <Button onClick={() => setCreateUserModalOpen(true)} disabled={!selectedOrg}>
              Crear Usuario
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkCreateModalOpen(true)}
              disabled={!selectedOrg}
            >
              Carga masiva CSV
            </Button>
          </div>

          <Alert color="secondary" variant="soft" className="mb-4">
            <AlertTitle>Invitar usuario</AlertTitle>
            <AlertDescription className="mt-2">
              <InviteForm
                orgId={selectedOrg}
                members={members}
                onInvited={() => selectedOrg && void loadInvitations(selectedOrg)}
              />
            </AlertDescription>
          </Alert>

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
        </TabsContent>

        <TabsContent value="invitations" className="pt-4">
          <div className="rounded-md border border-default-200 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Correo Electrónico</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha de Creación</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingInvitations ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <div className="flex items-center justify-center gap-2 text-default-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando invitaciones...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : invitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-default-500">
                      No se encontraron invitaciones.
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>{invitation.role}</TableCell>
                      <TableCell>{new Date(invitation.created_at).toLocaleString()}</TableCell>
                      <TableCell>{new Date(invitation.expires_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {invitation.accepted_at ? (
                          <Badge color="success">Aceptada</Badge>
                        ) : (
                          <Badge color="warning">Pendiente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

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

      <BulkCreateModal
        open={bulkCreateModalOpen}
        orgId={selectedOrg}
        onClose={() => setBulkCreateModalOpen(false)}
        onCompleted={() => {
          if (selectedOrg) {
            void loadMembers(selectedOrg);
          }
        }}
        onMessage={(message) => setMembersMessage(message)}
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
