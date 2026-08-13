import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { getApiAuthContext } from '@/lib/api-auth-context';
import { requestVouchekSelfPasswordReset } from '@/lib/universal-auth-api';

export async function POST(req: NextRequest) {
  try {
    const { user } = await getApiAuthContext(req);

    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json({ error: ApiErrors.USER_EMAIL_NOT_FOUND }, { status: 400 });
    }

    const result = await requestVouchekSelfPasswordReset();
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || ApiErrors.PASSWORD_RESET_EMAIL },
        { status: result.status >= 400 ? result.status : 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
