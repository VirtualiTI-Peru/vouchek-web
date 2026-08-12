import type { PortalContext } from '@/lib/portalContext';
import { VOUCHEK_ROLES, isVouchekRole } from '@/lib/roles';

export function canAccessOrgReports(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return (
    ctx.isSuperAdmin ||
    isVouchekRole(
      ctx.role,
      VOUCHEK_ROLES.SYSADMIN,
      VOUCHEK_ROLES.VERIFICADOR,
      VOUCHEK_ROLES.TRANSPORTISTA,
    )
  );
}

export function canSeeAllOrgReports(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return (
    ctx.isSuperAdmin ||
    isVouchekRole(ctx.role, VOUCHEK_ROLES.SYSADMIN, VOUCHEK_ROLES.VERIFICADOR)
  );
}

export function isOwnReceiptsOnly(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return isVouchekRole(ctx.role, VOUCHEK_ROLES.TRANSPORTISTA) && !ctx.isSuperAdmin;
}

export function canManageUsers(ctx: PortalContext): boolean {
  return ctx.isSuperAdmin || isVouchekRole(ctx.role, VOUCHEK_ROLES.SYSADMIN);
}

export function canViewOrgPlanUsage(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return (
    ctx.isSuperAdmin ||
    isVouchekRole(ctx.role, VOUCHEK_ROLES.SYSADMIN, VOUCHEK_ROLES.VERIFICADOR)
  );
}
