import type { PortalContext } from '@/lib/portalContext';

export function canAccessOrgReports(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return (
    ctx.isSuperAdmin ||
    ctx.role === 'org:sistema' ||
    ctx.role === 'org:verificador' ||
    ctx.role === 'org:admin' ||
    ctx.role === 'org:transportista'
  );
}

export function canSeeAllOrgReports(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return (
    ctx.isSuperAdmin ||
    ctx.role === 'org:sistema' ||
    ctx.role === 'org:verificador' ||
    ctx.role === 'org:admin'
  );
}

export function isOwnReceiptsOnly(ctx: PortalContext | null | undefined): boolean {
  if (!ctx) return false;
  return ctx.role === 'org:transportista' && !ctx.isSuperAdmin;
}

export function canManageUsers(ctx: PortalContext): boolean {
  return ctx.isSuperAdmin || ctx.role === 'org:admin' || ctx.role === 'org:sistema';
}
