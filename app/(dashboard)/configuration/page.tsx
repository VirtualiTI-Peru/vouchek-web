
"use client";
import React, { useState, useEffect } from "react";
import CustomersTable from "@/app/components/CustomersTable";
import { fetchCustomersServerAction } from "./fetch-action";
import { syncCustomersServerAction } from "./sync-action";
import { useUser, useOrganization } from "@clerk/nextjs";

export default function SuperAdminPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { user } = useUser();
  const { membership } = useOrganization();

  const superAdmins = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS ?? '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  const isSuperAdmin = superAdmins.includes(user?.emailAddresses?.[0]?.emailAddress ?? '');
  const isOrgAdmin = membership?.role === 'admin';
  
  // Initial fetch on mount
  useEffect(() => {
    setLoading(true);
    fetchCustomersServerAction().then((res) => {
      if (res.success) setCustomers(res.customers);
      else alert(res.message);
    }).finally(() => setLoading(false));
  }, []);


  const handleSync = async () => {
    setSyncing(true);
    const result = await syncCustomersServerAction();
    alert(result.message);
    // Refresh customers list after sync
    setLoading(true);
    fetchCustomersServerAction().then((res) => {
      if (res.success) setCustomers(res.customers);
      else alert(res.message);
    }).finally(() => setLoading(false));
    setSyncing(false);
  };

  if (!isSuperAdmin && !isOrgAdmin) {
    return <div>Acceso denegado.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="flex items-center mb-2">
          <div className="font-medium mr-4">Lista de Clientes (Clerk Organizations)</div>
          <form action={handleSync}>
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-4 rounded"
              type="submit"
              disabled={syncing}
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </form>
        </div>
        {loading ? (
          <div>Estamos preparando los datos...</div>
        ) : (
          <CustomersTable customers={customers}></CustomersTable>
        )}
      </div>
    </div>
  );
}
