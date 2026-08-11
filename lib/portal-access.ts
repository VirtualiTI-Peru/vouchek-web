import type { PortalContext } from '@/lib/portalContext';
import { VOUCHEK_ROLES, isVouchekRole } from '@/lib/roles';

export function canAccessOrgReports(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return (
    ctx.isSuperAdmin ||
    isVouchekRole(ctx.role, VOUCHEK_ROLES.SISTEMA, VOUCHEK_ROLES.VERIFICADOR, VOUCHEK_ROLES.ADMIN, VOUCHEK_ROLES.TRANSPORTISTA)
  );
}

export function canSeeAllOrgReports(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return (
    ctx.isSuperAdmin ||
    isVouchekRole(ctx.role, VOUCHEK_ROLES.SISTEMA, VOUCHEK_ROLES.VERIFICADOR, VOUCHEK_ROLES.ADMIN)
  );
}

export function isOwnReceiptsOnly(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return isVouchekRole(ctx.role, VOUCHEK_ROLES.TRANSPORTISTA) && !ctx.isSuperAdmin;
}

export function canManageUsers(ctx: PortalContext): boolean {
  return ctx.isSuperAdmin || isVouchekRole(ctx.role, VOUCHEK_ROLES.ADMIN, VOUCHEK_ROLES.SISTEMA);
}

export function canViewOrgPlanUsage(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return (
    ctx.isSuperAdmin ||
    isVouchekRole(ctx.role, VOUCHEK_ROLES.ADMIN, VOUCHEK_ROLES.SISTEMA, VOUCHEK_ROLES.VERIFICADOR)
  );
}
