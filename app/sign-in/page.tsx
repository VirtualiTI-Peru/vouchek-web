'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mapSupabaseAuthError } from '@/lib/auth-errors';
import { loadRememberedEmail, persistRememberedEmail } from '@/lib/remember-email';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  useEffect(() => {
    void loadRememberedEmail().then(({ email: savedEmail, remember }) => {
      if (remember && savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    });
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(mapSupabaseAuthError(signInError.message));
      setLoading(false);
    } else {
      persistRememberedEmail(email, rememberEmail);
      router.push('/dashboard');
      router.refresh();
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Ingresa tu correo electrónico para restablecer la contraseña.');
      return;
    }

    setResettingPassword(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? 'No se pudo enviar el correo de restablecimiento.');
        return;
      }

      setSuccessMessage(
        data?.message ?? 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
      );
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-stretch overflow-hidden bg-default-50">
      <div className="hidden lg:flex flex-1 flex-col justify-start px-20 pt-16 xl:pt-20 pb-12 bg-default-100 dark:bg-default-50">
        <Link href="/" className="mb-6 inline-flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">V</div>
          <span className="text-2xl font-semibold text-default-900">VouChek</span>
        </Link>
        <h2 className="text-4xl text-default-600 leading-tight max-w-lg">
          Digitalización de
          <span className="text-default-900 font-bold ms-2">comprobantes de pago</span>
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
            <h1 className="text-2xl font-semibold text-default-900">Iniciar sesión</h1>
            <p className="text-default-500 mt-2">Ingresa a tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-default-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="h-4 w-4 rounded border-default-300"
              />
              Recordarme
            </label>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                required
                autoComplete="current-password"
              />
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading || resettingPassword}
                  className="text-sm text-primary hover:underline disabled:opacity-50 disabled:no-underline min-h-11 inline-flex items-center px-1 sm:min-h-0"
                >
                  {resettingPassword ? 'Enviando enlace...' : '¿Olvidaste tu contraseña?'}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {successMessage && (
              <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                {successMessage}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading || resettingPassword}>
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-default-500 pb-8">© VirtualiTI - VouChek</p>
      </div>
    </div>
  );
}
