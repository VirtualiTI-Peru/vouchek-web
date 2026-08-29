import type { PlanTier } from '@/lib/plans';

export type OrganizationUsage = {
  orgId: string;
  planTier: PlanTier;
  periodKey: string;
  includedUsers: number;
  includedReceiptsPerMonth: number;
  maxUsers: number | null;
  maxReceiptsPerMonth: number | null;
  activeUsers: number;
  pendingInvites: number;
  usersReserved: number;
  extraUsers: number;
  receiptsUsed: number;
  extraReceipts: number;
  isTrial: boolean;
  isActive: boolean;
  subscriptionEndsAt: string | null;
  monthlyFeePen: number | null;
  demoEnabled: boolean;
  demoDays: number | null;
  subscriptionExpired: boolean;
  accessBlocked: boolean;
};
