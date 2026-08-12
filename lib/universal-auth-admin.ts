import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { VOUCHEK_APPLICATION_ID } from '@/lib/auth';
import { normalizeVouchekRole, type VouchekRoleSlug } from '@/lib/roles';

/** Universal Auth Supabase (identity + tenant_users). */
export function getUniversalAuthAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.UNIVERSAL_AUTH_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error(
      'Falta NEXT_PUBLIC_SUPABASE_URL / UNIVERSAL_AUTH_SERVICE_ROLE_KEY para administrar usuarios en Universal Auth.',
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function resolveApplicationRoleId(
  admin: SupabaseClient,
  roleSlug: VouchekRoleSlug,
): Promise<string> {
  const { data, error } = await admin
    .from('application_roles')
    .select('id, slug')
    .eq('application_id', VOUCHEK_APPLICATION_ID)
    .ilike('slug', roleSlug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new Error(`Rol ${roleSlug} no existe en Universal Auth para VouChek.`);
  }
  return data.id as string;
}

export async function ensureUaProfile(
  admin: SupabaseClient,
  userId: string,
  fullName: string,
): Promise<string> {
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.id) {
    await admin.from('profiles').update({ full_name: fullName }).eq('id', existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await admin
    .from('profiles')
    .insert({
      user_id: userId,
      full_name: fullName,
      is_super_admin: false,
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    throw new Error(error?.message || 'No se pudo crear el perfil en Universal Auth.');
  }
  return created.id as string;
}

export async function ensureApplicationTenant(
  admin: SupabaseClient,
  tenantId: string,
): Promise<void> {
  const { data: existing } = await admin
    .from('application_tenants')
    .select('application_id')
    .eq('application_id', VOUCHEK_APPLICATION_ID)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existing) return;

  const { error } = await admin.from('application_tenants').insert({
    application_id: VOUCHEK_APPLICATION_ID,
    tenant_id: tenantId,
    plan_code: 'trial',
    status: 'trial',
    trial_starts_at: new Date().toISOString(),
    trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) {
    // Tenant row may be missing in UA — caller should create tenant in UA admin first.
    throw new Error(
      `No se pudo asignar la app al tenant ${tenantId} en Universal Auth: ${error.message}`,
    );
  }
}

/** True if the auth user is assigned to the tenant for VouChek in Universal Auth. */
export async function getUaTenantMembership(params: {
  admin: SupabaseClient;
  userId: string;
  tenantId: string;
}): Promise<{ profileId: string; isSuperAdmin: boolean; fullName: string | null } | null> {
  const { data: profile, error: profileError } = await params.admin
    .from('profiles')
    .select('id, is_super_admin, full_name')
    .eq('user_id', params.userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile?.id) return null;

  const { data: memberships, error: membershipError } = await params.admin
    .from('tenant_users')
    .select('profile_id')
    .eq('application_id', VOUCHEK_APPLICATION_ID)
    .eq('tenant_id', params.tenantId)
    .eq('profile_id', profile.id)
    .limit(1);

  if (membershipError) throw new Error(membershipError.message);
  if (!memberships?.length) return null;

  return {
    profileId: profile.id as string,
    isSuperAdmin: profile.is_super_admin === true,
    fullName: (profile.full_name as string | null) ?? null,
  };
}

export async function assignTenantUser(params: {
  admin: SupabaseClient;
  profileId: string;
  tenantId: string;
  roleSlug: string;
}): Promise<void> {
  const role = normalizeVouchekRole(params.roleSlug);
  if (!role) throw new Error(`Rol inválido: ${params.roleSlug}`);

  await ensureApplicationTenant(params.admin, params.tenantId);
  const roleId = await resolveApplicationRoleId(params.admin, role);

  const { data: existing } = await params.admin
    .from('tenant_users')
    .select('profile_id')
    .eq('application_id', VOUCHEK_APPLICATION_ID)
    .eq('tenant_id', params.tenantId)
    .eq('profile_id', params.profileId)
    .eq('role_id', roleId)
    .maybeSingle();

  if (existing) return;

  const { error } = await params.admin.from('tenant_users').insert({
    application_id: VOUCHEK_APPLICATION_ID,
    tenant_id: params.tenantId,
    profile_id: params.profileId,
    role_id: roleId,
  });

  if (error) throw new Error(error.message);
}

export function normalizeCreateRole(role: unknown): VouchekRoleSlug {
  return normalizeVouchekRole(String(role ?? 'TRANSPORTISTA')) ?? 'TRANSPORTISTA';
}
