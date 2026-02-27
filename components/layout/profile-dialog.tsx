'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ProfileDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setError('');
    setLoadingProfile(true);
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        setFirstName(data?.firstName ?? '');
        setLastName(data?.lastName ?? '');
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [open]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Nombre y apellido son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo actualizar el perfil.');
        return;
      }
      setMessage('Perfil actualizado correctamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    setMessage('');
    setError('');
    setResetting(true);
    try {
      const res = await fetch('/api/profile/reset-password', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo enviar el correo de restablecimiento.');
        return;
      }
      setMessage('Se envió un enlace para restablecer tu contraseña a tu correo.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && !resetting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mi perfil</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          {loadingProfile ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={saving || resetting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={saving || resetting}
                />
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleResetPassword()}
              disabled={saving || resetting || loadingProfile}
            >
              {resetting ? 'Enviando...' : 'Restablecer contraseña'}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving || resetting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || resetting || loadingProfile}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
