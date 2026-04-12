import { getPortalContext } from './portalContext';
import type { Receipt, Customer } from './api-types';

export async function fetchReceipts(customerId: string): Promise<Receipt[]> {
  const url = new URL('/api/receipts', getApiBaseUrl());
  url.searchParams.set('customerId', customerId);
  return apiFetch<Receipt[]>(url);
}

export async function fetchCustomers(): Promise<Customer[]> {
  const ctx = await getPortalContext();
  const url = new URL('/api/customers', getApiBaseUrl());
  if (ctx.isSuperAdmin) {
    url.searchParams.set('superAdmin', 'true');
  }
  return apiFetch<Customer[]>(url);
}

// --- Helpers ---

function getApiBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) throw new Error('Missing API_BASE_URL');
  return baseUrl;
}

async function getAuthToken(): Promise<string> {
  const { createServerClient } = await import('@supabase/ssr');
  const { cookies } = await import('next/headers');
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
  if (!token) throw new Error('Missing auth token');
  return token;
}

async function apiFetch<T>(url: URL, options?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  // Remove Authorization header for Azurite blob/image requests
  const isAzuriteBlob = url.toString().startsWith('http://127.0.0.1:10000/');
  const headers = new Headers(options?.headers);
  if (!isAzuriteBlob) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error('API error:', res.status, errorText);
    throw new Error(errorText || `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}


