
"use client";
import React, { useState, useEffect } from "react";
import CustomersTable from "@/app/components/CustomersTableMantine";
import { createBrowserClient } from "@supabase/ssr";
import {
  TextInput,
  Button,
  Checkbox,
  Group,
  Title,
  Paper,
  Stack,
  Loader,
} from "@mantine/core";

type Organization = {
  id: string;
  name: string;
  code: string;
  ruc: string | null;
  is_active: boolean;
  created_at?: string;
};

export default function SuperAdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [ruc, setRuc] = useState('');
  const [isActive, setIsActive] = useState(true);

  const superAdmins = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS ?? '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  const isSuperAdmin = !!userEmail && superAdmins.some(e => e.toLowerCase() === userEmail.toLowerCase());
  const isOrgAdmin = userRole === 'org:admin';
  
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? '');
      setUserRole(session?.user?.app_metadata?.role ?? '');
    });
  }, []);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/organizations', { cache: 'no-store' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        alert(data?.error ?? 'No se pudo cargar organizaciones');
        setOrganizations([]);
        return;
      }
      setOrganizations(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    void loadOrganizations();
  }, []);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('Nombre y codigo son obligatorios.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/superadmin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          ruc: ruc.trim(),
          isActive,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? 'No se pudo crear la organizacion.');
        return;
      }

      setName('');
      setCode('');
      setRuc('');
      setIsActive(true);
      await loadOrganizations();
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (organization: Organization, nextActive: boolean) => {
    const actionLabel = nextActive ? 'activar' : 'inactivar';
    if (!confirm(`Deseas ${actionLabel} la organizacion ${organization.name}?`)) {
      return;
    }

    const res = await fetch('/api/superadmin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: organization.id, isActive: nextActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? 'No se pudo actualizar el estado.');
      return;
    }

    await loadOrganizations();
  };

  if (!isSuperAdmin && !isOrgAdmin) {
    return <div>Acceso denegado.</div>;
  }

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Title order={4} mb="md">Lista de Organizaciones</Title>

        {isSuperAdmin && (
          <Paper withBorder p="md" mb="md" bg="gray.0">
            <form onSubmit={handleCreateOrganization}>
              <Group grow mb="md">
                <TextInput
                  placeholder="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={creating}
                  required
                />
                <TextInput
                  placeholder="Código"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={creating}
                  required
                />
                <TextInput
                  placeholder="RUC"
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  disabled={creating}
                />
              </Group>

              <Group justify="space-between" align="center">
                <Checkbox
                  label="Activo"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={creating}
                />
                <Button
                  type="submit"
                  disabled={creating}
                  loading={creating}
                >
                  Crear organización
                </Button>
              </Group>
            </form>
          </Paper>
        )}

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
            <span>Cargando organizaciones...</span>
          </Group>
        ) : (
          <CustomersTable
            organizations={organizations}
            canManage={isSuperAdmin}
            onToggleStatus={handleToggleStatus}
          />
        )}
      </Paper>
    </Stack>
  );
}
