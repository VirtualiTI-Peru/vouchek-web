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

// Sync Clerk organizations to backend Customers table
export async function syncCustomersFromClerk(): Promise<any> {
  const token = await getAuthToken();
  const url = new URL('/api/customers/sync-from-clerk', getApiBaseUrl());
  
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `API error: ${res.status}`);
  }
  return res.json();
}

// --- Helpers ---

function getApiBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) throw new Error('Missing API_BASE_URL');
  return baseUrl;
}

async function getAuthToken(): Promise<string> {
  const template = process.env.CLERK_JWT_TEMPLATE;
  const { auth } = await import('@clerk/nextjs/server');
  const session = await auth();
  const token = await session.getToken(template ? { template } : undefined);
  if (!token) throw new Error('Missing auth token');
  return token;
}

async function apiFetch<T>(url: URL, options?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  // Remove Authorization header for Azurite blob/image requests
  const isAzuriteBlob = typeof url === 'string' ? url.startsWith('http://127.0.0.1:10000/') : url.toString().startsWith('http://127.0.0.1:10000/');
  const headers = {
    ...(options?.headers || {})
  };
  if (!isAzuriteBlob) {
    headers['Authorization'] = `Bearer ${token}`;
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


