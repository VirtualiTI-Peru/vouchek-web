'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import CustomersTable from '@/app/components/CustomersTable';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';

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
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [ruc, setRuc] = useState('');
  const [isActive, setIsActive] = useState(true);

  const superAdmins = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const isSuperAdmin = !!userEmail && superAdmins.some((e) => e.toLowerCase() === userEmail.toLowerCase());

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? '');
    });
  }, []);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/organizations', { cache: 'no-store' });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setOrganizations([]);
        return;
      }
      setOrganizations(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrganizations();
  }, []);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('Nombre y código son obligatorios.');
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
        alert(data?.error ?? 'No se pudo crear el cliente.');
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
    if (!confirm(`¿Deseas ${actionLabel} el cliente ${organization.name}?`)) {
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

  if (!isSuperAdmin) {
    return <div className="text-default-600">Acceso denegado.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-default-900">Clientes</h1>
      <Card className="border-default-200">
        <CardContent className="space-y-6 pt-6">
          <form onSubmit={handleCreateOrganization} className="space-y-4 p-4 rounded-lg bg-default-50 border border-default-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} disabled={creating} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} disabled={creating} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ruc">RUC</Label>
                <Input id="ruc" placeholder="RUC" value={ruc} onChange={(e) => setRuc(e.target.value)} disabled={creating} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox id="active" checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} disabled={creating} />
                <Label htmlFor="active">Activo</Label>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? 'Añadiendo...' : 'Añadir'}
              </Button>
            </div>
          </form>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-default-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Cargando clientes...</span>
            </div>
          ) : (
            <CustomersTable
              organizations={organizations}
              canManage={isSuperAdmin}
              onToggleStatus={handleToggleStatus}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
