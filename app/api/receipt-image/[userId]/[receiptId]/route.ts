import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiBaseUrl = process.env.API_BASE_URL;
    if (!apiBaseUrl) {
      return NextResponse.json({ error: 'Missing API_BASE_URL' }, { status: 500 });
    }

    const { userId, receiptId } = await params;
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
    return NextResponse.json({ error: error?.message || 'Failed to fetch image' }, { status: 500 });
  }
}
