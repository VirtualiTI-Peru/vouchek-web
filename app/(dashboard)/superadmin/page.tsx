
"use client";
import React, { useState, useEffect } from "react";
import CustomersTable from "@/app/components/CustomersTable";
import { fetchCustomersServerAction } from "./fetch-action";
import { syncCustomersServerAction } from "./sync-action";

export default function SuperAdminPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);


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

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="flex items-center mb-2">
          <div className="font-medium mr-4">Customer List (Clerk Organizations)</div>
          <form action={handleSync}>
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-4 rounded"
              type="submit"
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </form>
        </div>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <CustomersTable customers={customers}></CustomersTable>
        )}
      </div>
    </div>
  );
}
