
"use client";
import React, { useState, useEffect } from "react";
import CustomersTable from "@/app/components/CustomersTable";
import { createBrowserClient } from "@supabase/ssr";

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
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="flex items-center mb-2">
          <div className="font-medium mr-4">Lista de Organizaciones</div>
        </div>
        {isSuperAdmin && (
          <form onSubmit={handleCreateOrganization} className="mb-4 grid gap-2 rounded border bg-slate-50 p-3 md:grid-cols-5">
            <input
              className="rounded border px-2 py-1"
              placeholder="Nombre"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={creating}
            />
            <input
              className="rounded border px-2 py-1"
              placeholder="Codigo"
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={creating}
            />
            <input
              className="rounded border px-2 py-1"
              placeholder="RUC"
              value={ruc}
              onChange={e => setRuc(e.target.value)}
              disabled={creating}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                disabled={creating}
              />
              Activo
            </label>
            <button
              className="rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              type="submit"
              disabled={creating}
            >
              {creating ? 'Creando...' : 'Crear organizacion'}
            </button>
          </form>
        )}
        {loading ? (
          <div>Estamos preparando los datos...</div>
        ) : (
          <CustomersTable
            organizations={organizations}
            canManage={isSuperAdmin}
            onToggleStatus={handleToggleStatus}
          ></CustomersTable>
        )}
      </div>
    </div>
  );
}
