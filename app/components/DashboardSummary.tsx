'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReceiptsSummaryByDate } from '@/lib/api-types';
import { getSourceBackgroundColor, getSourceForegroundColor } from '@/lib/source-colors';
import { fetchReceiptsSummaryByDate as fetchReceiptsSummaryByDateClient } from '@/lib/webapi-client';
import { getTimezoneOffsetMinutes } from '@/lib/work-date';
import { WORK_CUSTOMER_ID_PARAM } from '@/lib/work-org';

type Props = {
  customerId?: string;
  data: ReceiptsSummaryByDate | null;
  date: string;
  initialTimezoneOffsetMinutes?: number;
  showUserTotals?: boolean;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);

export default function DashboardSummary({
  customerId = '',
  data,
  date,
  initialTimezoneOffsetMinutes,
  showUserTotals = true,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [summaryData, setSummaryData] = useState<ReceiptsSummaryByDate | null>(data);
  const [sortBy, setSortBy] = useState<'fullName' | 'transactionSource' | 'totalAmount'>('totalAmount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const summaryCacheRef = useRef<Record<string, ReceiptsSummaryByDate | null>>({});

  function buildSummaryCacheKey(nextCustomerId: string, nextDate: string, timezoneOffsetMinutes: number): string {
    return `${nextCustomerId}:${nextDate}:${timezoneOffsetMinutes}`;
  }

  async function loadSummary(nextCustomerId: string, nextDate: string, timezoneOffsetMinutes: number) {
    const cacheKey = buildSummaryCacheKey(nextCustomerId, nextDate, timezoneOffsetMinutes);
    const cachedSummary = summaryCacheRef.current[cacheKey];
    if (cachedSummary) {
      setSummaryData(cachedSummary);
      return;
    }

    if (!nextCustomerId) {
      setSummaryData(null);
      return;
    }

    try {
      const nextSummary = await fetchReceiptsSummaryByDateClient(nextCustomerId, nextDate, {
        timezoneOffsetMinutes,
      });
      summaryCacheRef.current[cacheKey] = nextSummary;
      setSummaryData(nextSummary);
    } catch {
      setSummaryData(null);
    }
  }

  useEffect(() => {
    const effectiveTimezoneOffsetMinutes =
      typeof initialTimezoneOffsetMinutes === 'number'
        ? initialTimezoneOffsetMinutes
        : getTimezoneOffsetMinutes(date);

    if (!customerId) {
      setSummaryData(null);
      return;
    }

    const cacheKey = buildSummaryCacheKey(customerId, date, effectiveTimezoneOffsetMinutes);
    const canUseServerData =
      typeof initialTimezoneOffsetMinutes === 'number' &&
      data !== null;

    if (canUseServerData) {
      summaryCacheRef.current[cacheKey] = data;
      setSummaryData(data);
      return;
    }

    void loadSummary(customerId, date, effectiveTimezoneOffsetMinutes);
  }, [customerId, date, initialTimezoneOffsetMinutes, data]);

  function handleSort(column: 'fullName' | 'transactionSource' | 'totalAmount') {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  function openReceiptsView(options: { transactionSource: string; userId?: string; userName?: string }) {
    const params = new URLSearchParams();
    params.set('date', date);
    params.set('timezoneOffsetMinutes', String(getTimezoneOffsetMinutes(date)));
    if (customerId) params.set(WORK_CUSTOMER_ID_PARAM, customerId);
    params.set('transactionSource', options.transactionSource);
    if (options.userId) params.set('userId', options.userId);
    if (options.userName) params.set('userName', options.userName);
    router.push(`/receipts?${params.toString()}`);
  }

  const filteredAndSortedRows = useMemo(() => {
    const rows = summaryData?.totalsByUser ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = normalizedSearch
      ? rows.filter((row) => {
          const source = row.transactionSource.toLowerCase();
          const fullName = row.fullName.toLowerCase();
          const total = String(row.totalAmount).toLowerCase();
          return source.includes(normalizedSearch) || fullName.includes(normalizedSearch) || total.includes(normalizedSearch);
        })
      : rows;

    return [...filtered].sort((a, b) => {
      let compareResult = 0;
      if (sortBy === 'totalAmount') {
        compareResult = a.totalAmount - b.totalAmount;
      } else {
        compareResult = a[sortBy].localeCompare(b[sortBy], 'es', { sensitivity: 'base' });
      }
      return sortDir === 'asc' ? compareResult : -compareResult;
    });
  }, [summaryData?.totalsByUser, search, sortBy, sortDir]);

  const SortIcon = ({ column }: { column: typeof sortBy }) =>
    sortBy === column && sortDir === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4 text-default-900">Resumen por origen</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryData?.summaryBySource.map((item) => {
            const bg = getSourceBackgroundColor(item.transactionSource);
            const fg = getSourceForegroundColor(item.transactionSource);
            return (
            <Card
              key={item.transactionSource}
              className="cursor-pointer hover:shadow-md transition-shadow border-transparent"
              style={{ backgroundColor: bg }}
              onClick={() => openReceiptsView({ transactionSource: item.transactionSource })}
            >
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase" style={{ color: fg, opacity: 0.9 }}>
                  {item.transactionSource}
                </p>
                <p className="text-2xl font-bold mt-2" style={{ color: fg }}>
                  {formatCurrency(item.totalAmount)}
                </p>
              </CardContent>
            </Card>
            );
          })}
          {!summaryData?.summaryBySource.length && (
            <p className="text-default-500 col-span-full">Sin datos para la fecha seleccionada.</p>
          )}
        </div>
      </div>

      {showUserTotals && (
      <div>
        <h3 className="text-lg font-semibold mb-4 text-default-900">Totales por usuario</h3>
        <div className="space-y-2 mb-4 max-w-md">
          <Label htmlFor="search">Buscar</Label>
          <Input
            id="search"
            placeholder="Usuario, origen o total"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rounded-md border border-default-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => handleSort('fullName')}>
                    Usuario <SortIcon column="fullName" />
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => handleSort('transactionSource')}>
                    Origen <SortIcon column="transactionSource" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" className="inline-flex items-center gap-1 font-semibold ml-auto" onClick={() => handleSort('totalAmount')}>
                    Total <SortIcon column="totalAmount" />
                  </button>
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedRows.map((row) => (
                <TableRow key={`${row.userId}-${row.transactionSource}`}>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>
                    <Badge color="secondary">{row.transactionSource}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.totalAmount)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openReceiptsView({
                        transactionSource: row.transactionSource,
                        userId: row.userId,
                        userName: row.fullName,
                      })}
                      aria-label="Ver vouchers"
                      title="Ver vouchers"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredAndSortedRows.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-default-500">
                    Sin resultados con los filtros actuales.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      )}
    </div>
  );
}
