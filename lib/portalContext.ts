import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export type PortalRole = 'org:verificador' | 'org:admin' | string;

export type PortalContext = {
  userId: string;
  orgId: string;
  email?: string;
  role?: PortalRole;
  isSuperAdmin: boolean;
  fullName?: string;
};

export async function getPortalContext(): Promise<PortalContext> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) throw new Error('Not authenticated');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Missing auth token');

  const appMeta = user.app_metadata ?? {};
  const email = user.email;
  const orgId = (appMeta.org_id as string | undefined) ?? '';
  const role = (appMeta.role as string | undefined) as PortalRole | undefined;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('first_name, last_name, is_super_admin')
    .eq('user_id', user.id)
    .single();

  const firstName = profile?.first_name ?? '';
  const lastName = profile?.last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim() || undefined;
  const isSuperAdmin = profile?.is_super_admin === true;

  if (!orgId && !isSuperAdmin) {
    throw new Error('Missing org_id claim');
  }

  return {
    userId: user.id,
    orgId,
    email,
    role,
    isSuperAdmin,
    fullName,
  };
}
