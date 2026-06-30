import { createClient } from '@supabase/supabase-js';

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !orgId) {
    return fallback;
  }

  const supabaseAdmin = createClient(url, serviceKey);

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
}
