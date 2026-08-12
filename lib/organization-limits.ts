import { effectiveReceiptLimit, effectiveUserLimit, type PlanTier } from '@/lib/plans';

export type OrganizationPlanRow = {
  id: string;
  name: string;
  code: string;
  ruc: string | null;
  is_active: boolean;
  created_at?: string;
  plan_tier: PlanTier;
  max_users: number;
  max_receipts_per_month: number;
  extra_users: number;
  extra_receipts: number;
  allow_receipt_overage: boolean;
  overage_fee_per_receipt: number | null;
  monthly_fee_pen: number | null;
  billing_cycle: string;
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  demo_enabled: boolean;
  demo_days: number | null;
};

export type OrganizationUsage = {
  orgId: string;
  planTier: PlanTier;
  periodKey: string;
  maxUsers: number;
  maxReceiptsPerMonth: number;
  activeUsers: number;
  pendingInvites: number;
  usersReserved: number;
  usersRemaining: number;
  receiptsUsed: number;
  receiptsRemaining: number;
  allowReceiptOverage: boolean;
  isActive: boolean;
  subscriptionEndsAt: string | null;
  monthlyFeePen: number | null;
  demoEnabled: boolean;
  demoDays: number | null;
  subscriptionExpired: boolean;
  accessBlocked: boolean;
};

export function summarizeOrganizationLimits(org: OrganizationPlanRow) {
  return {
    maxUsers: effectiveUserLimit(org.max_users, org.extra_users),
    maxReceiptsPerMonth: effectiveReceiptLimit(org.max_receipts_per_month, org.extra_receipts),
  };
}
