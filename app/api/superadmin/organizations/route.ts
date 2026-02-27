
export const runtime = "nodejs";
import { organizations } from '@clerk/clerk-sdk-node';
import { NextRequest, NextResponse } from 'next/server';

// API: GET /api/superadmin/organizations
export async function GET(req: NextRequest) {
  try {
    // Get all organizations from Clerk

    // Map Clerk orgs to only {id, name, slug}
    const rawOrgs = await organizations.getOrganizationList();
    const orgs = rawOrgs.map((org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug
    }));

    // Sync organizations to Customer table (backend API call)
    const backendUrl = process.env.API_BASE_URL;
    if (!backendUrl) throw new Error('Missing API_BASE_URL');
    const syncRes = await fetch(`${backendUrl}/customers/sync-from-clerk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizations: orgs })
    });
    if (!syncRes.ok) {
      const errText = await syncRes.text();
      throw new Error('Customer sync failed: ' + errText);
    }

    // After sync, fetch Customers table and return it
    const customersRes = await fetch(`${backendUrl}/customers`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!customersRes.ok) {
      const errText = await customersRes.text();
      throw new Error('Fetching customers failed: ' + errText);
    }
    const customers = await customersRes.json();
    return NextResponse.json(customers);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
