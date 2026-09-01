import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api-errors';
import { getPortalContext } from '@/lib/portalContext';
import { isOwnReceiptsOnly } from '@/lib/portal-access';
import { getServerAccessToken } from '@/lib/server-auth-token';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string; receiptId: string }> }
) {
  try {
    const token = await getServerAccessToken();
    if (!token) {
      return NextResponse.json({ error: ApiErrors.UNAUTHORIZED }, { status: 401 });
    }

    const apiBaseUrl = process.env.API_BASE_URL;
    if (!apiBaseUrl) {
      return NextResponse.json({ error: ApiErrors.SERVER_CONFIG }, { status: 500 });
    }

    const { userId, receiptId } = await params;

    const ctx = await getPortalContext();
    if (isOwnReceiptsOnly(ctx) && ctx.userId !== userId) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    // Proxy JPEG bytes. Redirecting to a blob SAS URL fails in the browser when
    // SAS cannot be signed (no account key) or storage is not reachable from the client.
    const backendUrl = `${apiBaseUrl}/api/receipts/${userId}/${receiptId}/image`;

    const backendRes = await fetch(backendUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!backendRes.ok) {
      return new NextResponse(null, { status: backendRes.status });
    }

    const bytes = await backendRes.arrayBuffer();
    const contentType = backendRes.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ApiErrors.FETCH_IMAGE;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
