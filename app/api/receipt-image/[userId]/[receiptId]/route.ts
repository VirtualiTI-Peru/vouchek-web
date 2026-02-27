import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ApiErrors } from '@/lib/api-errors';
import { getPortalContext } from '@/lib/portalContext';
import { isOwnReceiptsOnly } from '@/lib/portal-access';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string; receiptId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
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

    const backendUrl = `${apiBaseUrl}/api/receipts/${userId}/${receiptId}/image`;

    const backendRes = await fetch(backendUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!backendRes.ok) {
      return new NextResponse(null, { status: backendRes.status });
    }

    const contentType = backendRes.headers.get('content-type') ?? 'image/jpeg';
    const body = await backendRes.arrayBuffer();
    return new NextResponse(body, {
      headers: { 'Content-Type': contentType },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || ApiErrors.FETCH_IMAGE }, { status: 500 });
  }
}
