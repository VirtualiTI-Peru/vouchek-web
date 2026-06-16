export type PlanTier = 'inicial' | 'esencial' | 'profesional' | 'corporativo' | 'enterprise';

export type PlanDefinition = {
  tier: PlanTier;
  label: string;
  maxUsers: number;
  maxReceiptsPerMonth: number;
  monthlyFeePen: number;
};

export const PLANS: Record<Exclude<PlanTier, 'enterprise'>, PlanDefinition> = {
  inicial: {
    tier: 'inicial',
    label: 'Inicial',
    maxUsers: 5,
    maxReceiptsPerMonth: 500,
    monthlyFeePen: 119,
  },
  esencial: {
    tier: 'esencial',
    label: 'Esencial',
    maxUsers: 10,
    maxReceiptsPerMonth: 1000,
    monthlyFeePen: 179,
  },
  profesional: {
    tier: 'profesional',
    label: 'Profesional',
    maxUsers: 30,
    maxReceiptsPerMonth: 2500,
    monthlyFeePen: 399,
  },
  corporativo: {
    tier: 'corporativo',
    label: 'Corporativo',
    maxUsers: 50,
    maxReceiptsPerMonth: 3500,
    monthlyFeePen: 749,
  },
};

export const PLAN_TIER_OPTIONS: { value: PlanTier; label: string }[] = [
  ...Object.values(PLANS).map((p) => ({ value: p.tier, label: p.label })),
  { value: 'enterprise', label: 'Enterprise' },
];

export function isPlanTier(value: string): value is PlanTier {
  return PLAN_TIER_OPTIONS.some((p) => p.value === value);
}

export function getPlanDefinition(tier: PlanTier): PlanDefinition | null {
  if (tier === 'enterprise') return null;
  return PLANS[tier];
}

export function resolvePlanLimits(
  tier: PlanTier,
  overrides?: { maxUsers?: number; maxReceiptsPerMonth?: number; monthlyFeePen?: number },
) {
  const base = getPlanDefinition(tier);
  return {
    maxUsers: overrides?.maxUsers ?? base?.maxUsers ?? 10,
    maxReceiptsPerMonth: overrides?.maxReceiptsPerMonth ?? base?.maxReceiptsPerMonth ?? 1000,
    monthlyFeePen: overrides?.monthlyFeePen ?? base?.monthlyFeePen ?? null,
  };
}

export function effectiveUserLimit(maxUsers: number, extraUsers: number) {
  return Math.max(0, maxUsers + extraUsers);
}

export function effectiveReceiptLimit(maxReceiptsPerMonth: number, extraReceipts: number) {
  return Math.max(0, maxReceiptsPerMonth + extraReceipts);
}
