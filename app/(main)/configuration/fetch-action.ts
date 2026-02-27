"use server";
import { fetchCustomers } from '@/lib/webapi';

export async function fetchCustomersServerAction() {
  'use server';
  try {
    const customers = await fetchCustomers();
    return { success: true, customers };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error al cargar las empresas', customers: [] };
  }
}
