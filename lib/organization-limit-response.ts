import { NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { OrganizationLimitError } from '@/lib/organization-limits';

export function organizationLimitErrorResponse(error: unknown) {
  if (!(error instanceof OrganizationLimitError)) {
    return null;
  }

  const status =
    error.code === 'USER_LIMIT_REACHED'
      ? 403
      : error.code === 'ORG_INACTIVE' || error.code === 'SUBSCRIPTION_EXPIRED'
        ? 403
        : 400;

  return NextResponse.json(
    {
      error:
        error.code === 'USER_LIMIT_REACHED'
          ? ApiErrors.USER_LIMIT_REACHED
          : error.code === 'ORG_INACTIVE'
            ? ApiErrors.ORG_INACTIVE
            : error.code === 'SUBSCRIPTION_EXPIRED'
              ? ApiErrors.SUBSCRIPTION_EXPIRED
              : error.message,
      code: error.code,
      details: error.details ?? null,
    },
    { status },
  );
}
