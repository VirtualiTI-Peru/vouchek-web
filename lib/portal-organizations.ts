import { createClient } from '@supabase/supabase-js';
import type { PortalContext } from '@/lib/portalContext';
import type { PortalOrganization } from '@/lib/work-org';

export async function loadPortalOrganizations(ctx: PortalContext): Promise<PortalOrganization[]> {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .order('name', { ascending: true });

    const allOrganizations = (orgs ?? []).map((organization: { id: string; name?: string | null }) => ({
      id: organization.id,
      name: organization.name ?? organization.id,
    }));

    if (!ctx.isSuperAdmin) {
      const ownOrganization = allOrganizations.find((organization) => organization.id === ctx.orgId);
      return ownOrganization
        ? [ownOrganization]
        : [{ id: ctx.orgId, name: ctx.orgId }];
    }

    return allOrganizations;
  } catch {
    return [];
  }
}
