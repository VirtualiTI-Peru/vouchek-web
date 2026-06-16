'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { mapSupabaseAuthError } from '@/lib/auth-errors';
import type { Session, User } from '@supabase/supabase-js';
import { VouchekLogo, VouchekMark } from '@/components/vouchek-logo';

function getEmailFromUser(user: User | null | undefined): string {
  if (!user) return '';

  if (user.email) return user.email;

  const identityEmail = user.identities
    ?.map((identity) => identity.identity_data?.email)
    .find((value): value is string => typeof value === 'string' && value.length > 0);

  if (identityEmail) return identityEmail;

  const metadataEmail = user.user_metadata?.email;
  return typeof metadataEmail === 'string' ? metadataEmail : '';
}

async function resolveEmail(
  supabase: ReturnType<typeof createBrowserClient>,
  session?: Session | null,
  user?: User | null,
): Promise<string> {
  const fromProvidedUser = getEmailFromUser(user) || getEmailFromUser(session?.user);
  if (fromProvidedUser) return fromProvidedUser;

  const { data: { user: authUser }, error } = await supabase.auth.getUser();
  if (!error) {
    const fromUser = getEmailFromUser(authUser);
    if (fromUser) return fromUser;
  }

  return '';
}

function getRecoveryParams() {
  if (typeof window === 'undefined') {
    return {
      hashParams: new URLSearchParams(),
      searchParams: new URLSearchParams(),
    };
  }

  return {
    hashParams: new URLSearchParams(window.location.hash.replace(/^#/, '')),
    searchParams: new URLSearchParams(window.location.search),
  };
}

function hasRecoveryParams() {
  const { hashParams, searchParams } = getRecoveryParams();
  return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery';
}

function isRecoverySession(session: Session | null | undefined): boolean {
  return Boolean(session?.user?.recovery_sent_at);
}

const MOBILE_RECOVERY_SOURCE_KEY = 'vouchek-set-password-source';

function captureMobileRecoverySource(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hashParams, searchParams } = getRecoveryParams();
  const source = searchParams.get('source') ?? hashParams.get('source');
  if (source === 'mobile') {
    window.sessionStorage.setItem(MOBILE_RECOVERY_SOURCE_KEY, 'mobile');
    return true;
  }

  return window.sessionStorage.getItem(MOBILE_RECOVERY_SOURCE_KEY) === 'mobile';
}

function clearMobileRecoverySource(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const isMobileFlow = window.sessionStorage.getItem(MOBILE_RECOVERY_SOURCE_KEY) === 'mobile';
  window.sessionStorage.removeItem(MOBILE_RECOVERY_SOURCE_KEY);
  return isMobileFlow;
}

async function rejectInvalidRecovery(
  supabase: ReturnType<typeof createBrowserClient>,
  message: string,
  setReady: (ready: boolean) => void,
  setInitializing: (initializing: boolean) => void,
  setError: (error: string) => void,
) {
  await supabase.auth.signOut();
  setReady(false);
  setInitializing(false);
  setError(message);
}

export default function SetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [ready, setReady] = useState(false);
  const [completedMobile, setCompletedMobile] = useState(false);

  useEffect(() => {
    let mounted = true;
    let subscriptionCleanup: (() => void) | undefined;

    const markReady = async (
      session?: Session | null,
      user?: User | null,
      options?: { trustedRecovery?: boolean },
    ) => {
      if (!mounted) return;
      if (!options?.trustedRecovery && !isRecoverySession(session)) {
        await rejectInvalidRecovery(
          supabase,
          'El enlace para configurar la contraseña no es válido o ya expiró. Solicita uno nuevo.',
          setReady,
          setInitializing,
          setError,
        );
        return;
      }
      setError(null);
      const resolvedEmail = await resolveEmail(supabase, session, user);
      setEmail(resolvedEmail);
      setReady(true);
      setInitializing(false);
      captureMobileRecoverySource();
      if (window.location.hash || window.location.search) {
        window.history.replaceState({}, '', '/set-password');
      }
    };

    const init = async () => {
      captureMobileRecoverySource();
      const expectsRecovery = hasRecoveryParams();
      const { hashParams, searchParams } = getRecoveryParams();
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const code = searchParams.get('code');
      const tokenHash =
        searchParams.get('token_hash') ||
        hashParams.get('token_hash') ||
        searchParams.get('token') ||
        hashParams.get('token');

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          void markReady(session, session.user, { trustedRecovery: true });
        }
      });
      subscriptionCleanup = () => subscription.unsubscribe();

      if (accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!mounted) return;
        if (sessionError || !data.session) {
          await rejectInvalidRecovery(
            supabase,
            'El enlace para configurar la contraseña no es válido o ya expiró. Solicita uno nuevo.',
            setReady,
            setInitializing,
            setError,
          );
          return;
        }
        await markReady(data.session, data.user, { trustedRecovery: true });
        return;
      }

      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (exchangeError || !data.session) {
          await rejectInvalidRecovery(
            supabase,
            'El enlace para configurar la contraseña no es válido o ya expiró. Solicita uno nuevo.',
            setReady,
            setInitializing,
            setError,
          );
          return;
        }
        await markReady(data.session, data.user, { trustedRecovery: true });
        return;
      }

      if (expectsRecovery && tokenHash) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        });
        if (!mounted) return;
        if (verifyError || !data.session) {
          await rejectInvalidRecovery(
            supabase,
            'El enlace para configurar la contraseña no es válido o ya expiró. Solicita uno nuevo.',
            setReady,
            setInitializing,
            setError,
          );
          return;
        }
        await markReady(data.session, data.user, { trustedRecovery: true });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (isRecoverySession(session)) {
        await markReady(session);
        return;
      }

      if (session) {
        await supabase.auth.signOut();
      }

      setReady(false);
      setInitializing(false);
      setError(
        expectsRecovery
          ? 'El enlace para configurar la contraseña no es válido o ya expiró. Solicita uno nuevo.'
          : 'No se encontró una solicitud válida para configurar contraseña.',
      );
    };

    void init();
    return () => {
      mounted = false;
      subscriptionCleanup?.();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(mapSupabaseAuthError(updateError.message));
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();

    const isMobileFlow = clearMobileRecoverySource();
    if (isMobileFlow) {
      setCompletedMobile(true);
      setReady(false);
      setLoading(false);
      return;
    }

    router.push('/sign-in');
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh w-full items-stretch overflow-hidden bg-default-50">
      <div className="hidden lg:flex flex-1 flex-col justify-start px-20 pt-16 xl:pt-20 pb-12 bg-default-100 dark:bg-default-50">
        <Link href="/" className="mb-6 inline-flex items-center">
          <VouchekLogo width={160} />
        </Link>
        <h2 className="text-4xl text-default-600 leading-tight max-w-lg">
          Configura tu
          <span className="text-default-900 font-bold ms-2">acceso seguro</span>
        </h2>
        <div className="mt-10 w-full max-w-xl opacity-90 pointer-events-none">
          <img src="/images/auth/VouCheckBrand.png" alt="" className="w-full h-auto" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-card">
        <div className="flex-1 flex flex-col justify-center max-w-[480px] w-full mx-auto px-6 py-10">
          <div className="lg:hidden flex justify-center mb-8">
            <VouchekMark size={40} />
          </div>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-default-900">Configurar contraseña</h1>
            <p className="text-default-500 mt-2">Define tu contraseña para completar el acceso a VouChek</p>
          </div>

          {initializing ? (
            <p className="text-sm text-default-500 text-center">Validando enlace...</p>
          ) : completedMobile ? (
            <Alert color="success" variant="soft">
              <AlertDescription className="space-y-2">
                <p className="font-medium text-default-900">Contraseña actualizada</p>
                <p>
                  Tu contraseña se cambió correctamente. Puedes cerrar esta página y volver a la
                  app VouChek móvil para iniciar sesión con tu nueva contraseña.
                </p>
              </AlertDescription>
            </Alert>
          ) : !ready ? (
            error && (
              <Alert color="destructive" variant="soft">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" value={email} autoComplete="email" readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
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
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </Button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-default-500 pb-8">© VirtualiTI - VouChek</p>
      </div>
    </div>
  );
}
