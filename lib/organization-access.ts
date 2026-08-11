import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';

export type OrganizationAccessStatus = {
  blocked: boolean;
  isActive: boolean;
  subscriptionEndsAt: string | null;
  demoEnabled: boolean;
  demoExpired: boolean;
};

// Estado de acceso de una organización para el portal/app.
// El acceso se bloquea si la empresa está inactiva o la suscripción/demo expiró.
export async function getOrganizationAccessStatus(
  orgId: string,
): Promise<OrganizationAccessStatus> {
  const fallback: OrganizationAccessStatus = {
    blocked: false,
    isActive: true,
    subscriptionEndsAt: null,
    demoEnabled: false,
    demoExpired: false,
  };

  if (!orgId) {
    return fallback;
  }

  try {
    const supabaseAdmin = getVouchekDataSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('is_active, subscription_ends_at, demo_enabled')
      .eq('id', orgId)
      .single();

    if (error || !data) {
      return fallback;
    }

    const isActive = data.is_active === true;
    const endsAt = data.subscription_ends_at ? new Date(data.subscription_ends_at) : null;
    const expired = endsAt != null && endsAt.getTime() < Date.now();

    return {
      blocked: !isActive || expired,
      isActive,
      subscriptionEndsAt: data.subscription_ends_at ?? null,
      demoEnabled: data.demo_enabled === true,
      demoExpired: expired && data.demo_enabled === true,
    };
  } catch {
    return fallback;
  }
}
