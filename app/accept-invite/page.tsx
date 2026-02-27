'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center bg-default-50 text-default-500">
        Validando invitación...
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setError(null);
      const inviteToken = searchParams.get('token');
      if (!inviteToken) {
        if (mounted) {
          setReady(false);
          setError('No se encontró el token de invitación.');
          setInitializing(false);
        }
        return;
      }

      const res = await fetch(`/api/invitations/resolve?token=${encodeURIComponent(inviteToken)}`);
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;

      if (!res.ok) {
        setReady(false);
        setError(data?.error ?? 'No se pudo validar la invitación. Solicita un nuevo enlace.');
        setInitializing(false);
        return;
      }

      if (!data?.email) {
        setReady(false);
        setError('No se pudo resolver el correo de la invitación. Solicita un nuevo enlace.');
        setInitializing(false);
        return;
      }

      setToken(inviteToken);
      setEmail(String(data.email));
      setReady(true);
      setInitializing(false);
    };

    void init();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Ingresa nombre y apellido.');
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
    if (!token) {
      setError('Invitación inválida.');
      return;
    }

    setLoading(true);
    const completeRes = await fetch('/api/complete-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, firstName, lastName, password }),
    });

    if (!completeRes.ok) {
      const data = await completeRes.json().catch(() => ({}));
      setError(data?.error ?? 'No se pudo completar el registro.');
      setLoading(false);
      return;
    }

    router.push('/sign-in');
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh w-full items-stretch overflow-hidden bg-default-50">
      <div className="hidden lg:flex flex-1 flex-col justify-start px-20 pt-16 xl:pt-20 pb-12 bg-default-100 dark:bg-default-50">
        <Link href="/" className="mb-6 inline-flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">V</div>
          <span className="text-2xl font-semibold text-default-900">VouChek</span>
        </Link>
        <h2 className="text-4xl text-default-600 leading-tight max-w-lg">
          Completa tu
          <span className="text-default-900 font-bold ms-2">registro</span>
        </h2>
        <div className="mt-10 w-full max-w-xl opacity-90 pointer-events-none">
          <img src="/images/auth/VouCheckBrand.png" alt="" className="w-full h-auto" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-card">
        <div className="flex-1 flex flex-col justify-center max-w-[480px] w-full mx-auto px-6 py-10">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">V</div>
          </div>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-default-900">Completa tu registro</h1>
            <p className="text-default-500 mt-2">Configura tu cuenta para ingresar a VouChek</p>
          </div>

          {initializing ? (
            <p className="text-sm text-default-500 text-center">Validando invitación...</p>
          ) : !ready ? (
            error && (
              <Alert color="destructive" variant="soft">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )
          ) : (
            <form onSubmit={handleComplete} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" value={email} autoComplete="email" readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  type="text"
                  name="firstName"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  type="text"
                  name="lastName"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert color="destructive" variant="soft">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Finalizando...' : 'Finalizar registro'}
              </Button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-default-500 pb-8">© VirtualiTI - VouChek</p>
      </div>
    </div>
  );
}
