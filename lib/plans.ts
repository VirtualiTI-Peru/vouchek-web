export type PlanTier = 'trial' | 'standard' | string;

export const PAID_INCLUDED_USERS = 5;
export const PAID_INCLUDED_RECEIPTS = 6000;
export const EXTRA_USER_PEN = 8;
export const EXTRA_RECEIPT_PEN = 0.023;
export const STANDARD_FEE_PEN = 109;

export type PlanDefinition = {
  tier: PlanTier;
  label: string;
  includedUsers: number;
  includedReceiptsPerMonth: number;
  monthlyFeePen: number | null;
};

export const PLANS: Record<'trial' | 'standard', PlanDefinition> = {
  trial: {
    tier: 'trial',
    label: 'Trial',
    includedUsers: 1,
    includedReceiptsPerMonth: 100,
    monthlyFeePen: null,
  },
  standard: {
    tier: 'standard',
    label: 'Standard',
    includedUsers: PAID_INCLUDED_USERS,
    includedReceiptsPerMonth: PAID_INCLUDED_RECEIPTS,
    monthlyFeePen: STANDARD_FEE_PEN,
  },
};

export const PLAN_TIER_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: 'trial', label: 'Trial' },
  { value: 'standard', label: 'Standard' },
];

export function isPlanTier(value: string): value is PlanTier {
  return PLAN_TIER_OPTIONS.some((p) => p.value === value);
}

export function getPlanDefinition(tier: PlanTier): PlanDefinition | null {
  if (tier === 'trial' || tier === 'standard') return PLANS[tier];
  return null;
}

export function isTrialPlan(planCode?: string | null, status?: string | null): boolean {
  return (
    (planCode ?? '').toLowerCase() === 'trial'
    || (status ?? '').toLowerCase() === 'trial'
  );
}

export function extraCount(current: number, included: number): number {
  return Math.max(0, current - included);
}

export function planUsedDisplay(current: number, included: number): string {
  return `${Math.min(current, included)}/${included}`;
}
