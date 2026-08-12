import type { SupabaseClient } from '@supabase/supabase-js';
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

export type CanAddUserResult = {
  allowed: boolean;
  slotsRequested: number;
  maxUsers: number;
  activeUsers: number;
  pendingInvites: number;
  usersReserved: number;
  usersRemaining: number;
};

const ORG_PLAN_SELECT =
  'id, name, code, ruc, is_active, created_at, plan_tier, max_users, max_receipts_per_month, extra_users, extra_receipts, allow_receipt_overage, overage_fee_per_receipt, monthly_fee_pen, billing_cycle, subscription_starts_at, subscription_ends_at, demo_enabled, demo_days';

export { ORG_PLAN_SELECT };

export async function getOrganizationUsage(
  supabaseAdmin: SupabaseClient,
  orgId: string,
): Promise<OrganizationUsage> {
  const { data, error } = await supabaseAdmin.rpc('get_organization_usage', { p_org_id: orgId });
  if (error) throw new Error(error.message);
  return data as OrganizationUsage;
}

export async function canAddOrganizationUser(
  supabaseAdmin: SupabaseClient,
  orgId: string,
  slots = 1,
): Promise<CanAddUserResult> {
  const { data, error } = await supabaseAdmin.rpc('can_add_organization_user', {
    p_org_id: orgId,
    p_slots: slots,
  });
  if (error) throw new Error(error.message);
  return data as CanAddUserResult;
}

export async function assertCanAddOrganizationUser(
  supabaseAdmin: SupabaseClient,
  orgId: string,
  slots = 1,
): Promise<CanAddUserResult> {
  let result: CanAddUserResult;
  try {
    result = await canAddOrganizationUser(supabaseAdmin, orgId, slots);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ORG_INACTIVE')) {
      throw new OrganizationLimitError('ORG_INACTIVE', 'La empresa está inactiva.');
    }
    if (message.includes('SUBSCRIPTION_EXPIRED')) {
      throw new OrganizationLimitError('SUBSCRIPTION_EXPIRED', 'La suscripción de la empresa ha vencido.');
    }
    throw error;
  }

  if (!result.allowed) {
    throw new OrganizationLimitError(
      'USER_LIMIT_REACHED',
      `Se alcanzó el límite de usuarios del plan (${result.usersReserved}/${result.maxUsers}).`,
      result,
    );
  }

  return result;
}

export class OrganizationLimitError extends Error {
  code: string;
  details?: CanAddUserResult;

  constructor(code: string, message: string, details?: CanAddUserResult) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function summarizeOrganizationLimits(org: OrganizationPlanRow) {
  return {
    maxUsers: effectiveUserLimit(org.max_users, org.extra_users),
    maxReceiptsPerMonth: effectiveReceiptLimit(org.max_receipts_per_month, org.extra_receipts),
  };
}
