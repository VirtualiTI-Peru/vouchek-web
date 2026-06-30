'use client';

import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function AccountSuspendedPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    router.push('/sign-in');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-default-50 px-4">
      <Card className="w-full max-w-md border-default-200">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-default-900">Acceso no disponible</h1>
          <p className="text-default-600">
            El periodo de acceso de tu empresa ha finalizado o la cuenta se encuentra
            inactiva. Si crees que es un error o deseas continuar usando VouChek,
            comunícate con tu administrador o con nuestro equipo de soporte.
          </p>
          <Button variant="outline" onClick={handleSignOut} className="mt-2">
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
