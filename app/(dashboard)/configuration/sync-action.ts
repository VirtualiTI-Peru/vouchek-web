"use server";
import { syncCustomersFromClerk } from '@/lib/webapi';

export async function syncCustomersServerAction() {
  'use server';
  try {
    const result = await syncCustomersFromClerk();
    return { success: true, message: result.message || 'Sync completed!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Sync failed' };
  }
}
