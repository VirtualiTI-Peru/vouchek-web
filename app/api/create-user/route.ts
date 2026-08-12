import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { canManageUsers } from '@/lib/portal-access';
import { provisionVouchekUser } from '@/lib/universal-auth-api';
import { normalizeCreateRole } from '@/lib/universal-auth-admin';

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role: callerRole, orgId: callerOrgId } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!canManageUsers({
      userId: user.id,
      orgId: callerOrgId ?? '',
      role: callerRole,
      isSuperAdmin,
    })) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const { email, firstName, lastName, orgId, role } = await req.json();
    if (!email || !orgId || !firstName || !lastName) {
      return NextResponse.json({ error: ApiErrors.MISSING_REQUIRED_FIELDS }, { status: 400 });
    }

    if (!isSuperAdmin && String(orgId) !== callerOrgId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN_ORG }, { status: 403 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedFirstName = String(firstName).trim();
    const normalizedLastName = String(lastName).trim();
    const normalizedRole = normalizeCreateRole(role);
    const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();

    const provisioned = await provisionVouchekUser({
      email: normalizedEmail,
      tenantId: String(orgId),
      roleSlug: normalizedRole,
      fullName,
    });

    if (!provisioned.ok) {
      return NextResponse.json(
        {
          error: provisioned.error,
          code: provisioned.code,
        },
        { status: provisioned.status >= 400 ? provisioned.status : 500 },
      );
    }

    return NextResponse.json({
      success: true,
      emailSent: provisioned.data.emailSent !== false,
      emailError:
        provisioned.data.emailSent === false
          ? (provisioned.data.message
            || 'Usuario creado, pero falló el envío del correo de bienvenida.')
          : undefined,
      message: provisioned.data.message,
      created: provisioned.data.created,
      assignedExisting: provisioned.data.assignedExisting,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ApiErrors.CREATE_USER;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
