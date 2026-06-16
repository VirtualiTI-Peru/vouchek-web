export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import { getOrganizationUsage } from '@/lib/organization-limits';
import { canAccessOrganization, getApiAuthContext } from '@/lib/api-auth-context';
import { canViewOrgPlanUsage } from '@/lib/portal-access';

async function getAuthContext(req: NextRequest) {
  return getApiAuthContext(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const normalizedOrgId = orgId?.trim();
    if (!normalizedOrgId) {
      return NextResponse.json({ error: ApiErrors.MISSING_ORG_ID }, { status: 400 });
    }

    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (
      !canViewOrgPlanUsage({ userId: user.id, orgId: callerOrgId, role, isSuperAdmin }) ||
      !canAccessOrganization(isSuperAdmin, callerOrgId, normalizedOrgId)
    ) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const usage = await getOrganizationUsage(supabaseAdmin, normalizedOrgId);
    return NextResponse.json(usage);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
