import type { PortalContext } from '@/lib/portalContext';
import type { PortalOrganization } from '@/lib/work-org';
import { listUaTenants, listVouchekAssignedTenantIds } from '@/lib/universal-auth-api';

/**
 * Organizations for the portal shell = Universal Auth tenants with VouChek assigned
 * (ApplicationTenants), regardless of trial/active/suspended status.
 * SuperAdmin sees all assigned; others see their session tenant(s).
 */
export async function loadPortalOrganizations(ctx: PortalContext): Promise<PortalOrganization[]> {
  if (!ctx.isSuperAdmin) {
    if (ctx.orgId) {
      return [{ id: ctx.orgId, name: ctx.orgId }];
    }
    return [];
  }

  try {
    const [tenants, assignedIds] = await Promise.all([
      listUaTenants(),
      listVouchekAssignedTenantIds(),
    ]);

    return tenants
      .filter((tenant) => assignedIds.has(tenant.id))
      .map((tenant) => ({
        id: tenant.id,
        name: tenant.name || tenant.code || tenant.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  } catch {
    if (ctx.orgId) {
      return [{ id: ctx.orgId, name: ctx.orgId }];
    }
    return [];
  }
}
