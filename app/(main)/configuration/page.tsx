'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import CustomersTable, { type OrganizationWithUsage } from '@/app/components/CustomersTable';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { PLAN_TIER_OPTIONS, type PlanTier } from '@/lib/plans';

export default function SuperAdminPage() {
  const [organizations, setOrganizations] = useState<OrganizationWithUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [ruc, setRuc] = useState('');
  const [planTier, setPlanTier] = useState<PlanTier>('esencial');
  const [isActive, setIsActive] = useState(true);
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialDays, setTrialDays] = useState('15');
  const [allowDuplicateReceipts, setAllowDuplicateReceipts] = useState(false);

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
      const res = await fetch('/api/superadmin/organizations?includeUsage=true', { cache: 'no-store' });
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

    const trialDaysNum = Math.floor(Number(trialDays));
    if (trialEnabled && (!Number.isFinite(trialDaysNum) || trialDaysNum < 1)) {
      alert('Indica un número de días de prueba válido (mínimo 1).');
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
          planTier,
          demoEnabled: trialEnabled,
          demoDays: trialEnabled ? trialDaysNum : null,
          allowDuplicateReceipts,
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
      setPlanTier('esencial');
      setIsActive(true);
      setTrialEnabled(false);
      setTrialDays('15');
      setAllowDuplicateReceipts(false);
      await loadOrganizations();
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (organization: OrganizationWithUsage, nextActive: boolean) => {
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

  const handlePlanChange = async (organization: OrganizationWithUsage, nextPlan: PlanTier) => {
    if (nextPlan === organization.plan_tier) return;

    const label = PLAN_TIER_OPTIONS.find((p) => p.value === nextPlan)?.label ?? nextPlan;
    if (!confirm(`¿Cambiar el plan de ${organization.name} a ${label}?`)) {
      return;
    }

    const res = await fetch('/api/superadmin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: organization.id, planTier: nextPlan }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? 'No se pudo actualizar el plan.');
      return;
    }

    await loadOrganizations();
  };

  const handleDemoChange = async (organization: OrganizationWithUsage) => {
    const current = organization.demo_enabled ? String(organization.demo_days ?? '') : '';
    const input = window.prompt(
      `Días de periodo de prueba para ${organization.name} (vacío o 0 para desactivar):`,
      current,
    );
    if (input === null) return;

    const trimmed = input.trim();
    const days = Math.floor(Number(trimmed));
    const enable = trimmed !== '' && Number.isFinite(days) && days >= 1;

    if (trimmed !== '' && !enable) {
      alert('Indica un número de días válido (mínimo 1) o deja vacío para desactivar.');
      return;
    }

    const res = await fetch('/api/superadmin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: organization.id,
        demoEnabled: enable,
        demoDays: enable ? days : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? 'No se pudo actualizar el periodo de prueba.');
      return;
    }

    await loadOrganizations();
  };

  const handleAllowDupesChange = async (organization: OrganizationWithUsage, next: boolean) => {
    const action = next ? 'permitir duplicados en resúmenes' : 'dejar de permitir duplicados';
    if (!confirm(`¿Deseas ${action} para ${organization.name}? (Solo para orgs DEMO / testers)`)) {
      return;
    }

    const res = await fetch('/api/superadmin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: organization.id,
        allowDuplicateReceipts: next,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? 'No se pudo actualizar el flag de duplicados.');
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <select
                  id="plan"
                  className="flex h-10 w-full rounded-md border border-default-200 bg-white px-3 text-sm dark:bg-card"
                  value={planTier}
                  onChange={(e) => setPlanTier(e.target.value as PlanTier)}
                  disabled={creating}
                >
                  {PLAN_TIER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox id="active" checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} disabled={creating} />
                  <Label htmlFor="active">Activo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="trial"
                    checked={trialEnabled}
                    onCheckedChange={(v) => setTrialEnabled(v === true)}
                    disabled={creating}
                  />
                  <Label htmlFor="trial">Periodo de prueba</Label>
                </div>
                {trialEnabled && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="trialDays">Días</Label>
                    <Input
                      id="trialDays"
                      type="number"
                      min={1}
                      className="w-24"
                      value={trialDays}
                      onChange={(e) => setTrialDays(e.target.value)}
                      disabled={creating}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="allowDupes"
                    checked={allowDuplicateReceipts}
                    onCheckedChange={(v) => setAllowDuplicateReceipts(v === true)}
                    disabled={creating}
                  />
                  <Label htmlFor="allowDupes">Permitir duplicados en resúmenes (DEMO / testers)</Label>
                </div>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? 'Añadiendo...' : 'Añadir'}
              </Button>
            </div>
          </form>

          {loading ? (
            <div className="flex items-center gap-2 justify-center py-10 text-default-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Cargando clientes...</span>
            </div>
          ) : (
            <CustomersTable
              organizations={organizations}
              canManage={isSuperAdmin}
              onToggleStatus={handleToggleStatus}
              onPlanChange={handlePlanChange}
              onDemoChange={handleDemoChange}
              onAllowDupesChange={handleAllowDupesChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
