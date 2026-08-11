import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { sendPasswordResetEmail } from '@/lib/sendInviteEmail';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { isVouchekRole, VOUCHEK_ROLES } from '@/lib/roles';
import { getVouchekDataSupabaseAdmin } from '@/lib/vouchek-data-supabase';
import { getUniversalAuthAdmin } from '@/lib/universal-auth-admin';

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role, orgId: callerOrgId } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!isSuperAdmin && !isVouchekRole(role, VOUCHEK_ROLES.ADMIN, VOUCHEK_ROLES.SISTEMA)) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const body = await req.json();
    const userId = String(body?.userId ?? '').trim();
    const orgId = String(body?.orgId ?? '').trim();

    if (!userId || !orgId) {
      return NextResponse.json({ error: ApiErrors.MISSING_USER_OR_ORG }, { status: 400 });
    }

    if (!isSuperAdmin && callerOrgId !== orgId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const dataAdmin = getVouchekDataSupabaseAdmin();
    const uaAdmin = getUniversalAuthAdmin();

    const [{ data: targetUserData, error: userError }, { data: membership }] = await Promise.all([
      uaAdmin.auth.admin.getUserById(userId),
      dataAdmin
        .from('organization_members')
        .select('org_id')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .maybeSingle(),
    ]);

    if (userError || !targetUserData?.user) {
      return NextResponse.json({ error: userError?.message || ApiErrors.USER_NOT_FOUND }, { status: 404 });
    }

    if (!membership) {
      return NextResponse.json({ error: ApiErrors.USER_NOT_IN_ORG }, { status: 400 });
    }

    const targetUser = targetUserData.user;

    if (!targetUser.email) {
      return NextResponse.json({ error: ApiErrors.USER_EMAIL_NOT_FOUND }, { status: 400 });
    }

    // Keep recovery links on a stable app host in UAT instead of deriving it from the request origin.
    const recoveryBaseUrl = process.env.INVITE_BASE_URL || req.nextUrl.origin;

    const [
      { data: org },
      { data: profile },
      { data: linkData, error: linkError },
    ] = await Promise.all([
      dataAdmin.from('organizations').select('name').eq('id', orgId).single(),
      dataAdmin.from('profiles').select('first_name').eq('user_id', userId).single(),
      uaAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetUser.email,
        options: {
          redirectTo: `${recoveryBaseUrl}/set-password`,
        },
      }),
    ]);

    const hashedToken = linkData?.properties?.hashed_token;
    const setupLink = hashedToken
      ? `${recoveryBaseUrl}/set-password?type=recovery&token_hash=${encodeURIComponent(hashedToken)}`
      : linkData?.properties?.action_link;

    if (linkError || !setupLink) {
      return NextResponse.json({ error: linkError?.message || ApiErrors.PASSWORD_SETUP_LINK }, { status: 500 });
    }

    const emailResult = await sendPasswordResetEmail({
      to: targetUser.email,
      changePasswordLink: setupLink,
      orgName: org?.name ?? orgId,
      firstName: profile?.first_name ?? 'Usuario',
    });

    if (emailResult.error) {
      return NextResponse.json({ error: ApiErrors.PASSWORD_SETUP_EMAIL }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
