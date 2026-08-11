import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for VouChek domain data (organizations, usage, local profiles/terms).
 * Auth identity uses Universal Auth (see lib/auth.ts) — a different Supabase project.
 */
export function getVouchekDataSupabaseAdmin(): SupabaseClient {
  const url = process.env.VOUCHEK_DATA_SUPABASE_URL?.trim();
  const serviceKey = process.env.VOUCHEK_DATA_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error(
      'Falta VOUCHEK_DATA_SUPABASE_URL / VOUCHEK_DATA_SUPABASE_SERVICE_ROLE_KEY (data plane VouChek).',
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
