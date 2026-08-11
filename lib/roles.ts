/** Canonical Universal Auth role slugs for VouChek. */
export const VOUCHEK_ROLES = {
  TRANSPORTISTA: "TRANSPORTISTA",
  VERIFICADOR: "VERIFICADOR",
  SISTEMA: "SISTEMA",
  ADMIN: "ADMIN",
} as const;

export type VouchekRoleSlug = (typeof VOUCHEK_ROLES)[keyof typeof VOUCHEK_ROLES];

const LEGACY_TO_SLUG: Record<string, VouchekRoleSlug> = {
  "org:transportista": VOUCHEK_ROLES.TRANSPORTISTA,
  transportista: VOUCHEK_ROLES.TRANSPORTISTA,
  "org:verificador": VOUCHEK_ROLES.VERIFICADOR,
  verificador: VOUCHEK_ROLES.VERIFICADOR,
  "org:sistema": VOUCHEK_ROLES.SISTEMA,
  sistema: VOUCHEK_ROLES.SISTEMA,
  "org:admin": VOUCHEK_ROLES.ADMIN,
  admin: VOUCHEK_ROLES.ADMIN,
  administrador: VOUCHEK_ROLES.ADMIN,
};

/** Normalize UA slug or legacy org:* role to a canonical slug. */
export function normalizeVouchekRole(role?: string | null): VouchekRoleSlug | null {
  if (!role?.trim()) return null;
  const raw = role.trim();
  const lower = raw.toLowerCase();
  if (LEGACY_TO_SLUG[lower]) return LEGACY_TO_SLUG[lower];

  const upper = raw.replace(/^org:/i, "").toUpperCase();
  if ((Object.values(VOUCHEK_ROLES) as string[]).includes(upper)) {
    return upper as VouchekRoleSlug;
  }
  return null;
}

export function isVouchekRole(role: string | null | undefined, ...expected: VouchekRoleSlug[]): boolean {
  const normalized = normalizeVouchekRole(role);
  if (!normalized) return false;
  return expected.includes(normalized);
}

export const ROLE_LABELS: Record<VouchekRoleSlug, string> = {
  TRANSPORTISTA: "Transportista",
  VERIFICADOR: "Verificador",
  SISTEMA: "Administrador del Sistema",
  ADMIN: "Administrador",
};

export const AVAILABLE_ROLES: { value: VouchekRoleSlug; label: string }[] = [
  { value: VOUCHEK_ROLES.TRANSPORTISTA, label: ROLE_LABELS.TRANSPORTISTA },
  { value: VOUCHEK_ROLES.SISTEMA, label: ROLE_LABELS.SISTEMA },
  { value: VOUCHEK_ROLES.VERIFICADOR, label: ROLE_LABELS.VERIFICADOR },
  { value: VOUCHEK_ROLES.ADMIN, label: ROLE_LABELS.ADMIN },
];
