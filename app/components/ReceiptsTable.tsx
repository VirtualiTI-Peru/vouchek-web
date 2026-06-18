'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FileType2,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import type { Receipt, ReceiptPage } from '@/lib/api-types';
import { fetchReceipts } from '@/lib/webapi-client';
import { normalizeWorkDate } from '@/lib/work-date';
import { WORK_CUSTOMER_ID_PARAM } from '@/lib/work-org';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type LoadReceiptsOptions = {
  forceRefresh?: boolean;
};

const DEFAULT_PAGE_SIZE = Number(process.env.NEXT_PUBLIC_RECEIPTS_PAGE_SIZE) || 50;
const INVALIDATION_POLL_MS = Number(process.env.NEXT_PUBLIC_RECEIPTS_POLL_MS) || 15000;

const LIMA_TIMEZONE = 'America/Lima';

const formatCurrencyPen = (amount?: number | null) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return '';
  }

  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount);
};

const formatDateLima = (iso?: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-PE', { timeZone: LIMA_TIMEZONE });
};

function buildExportHeaders(includeUserColumn: boolean): string[] {
  const headers = [
    'ID Voucher',
    'Imagen',
    'Fecha de Captura',
    'Origen',
    'Importe',
    'Fecha Operación',
    'Nº Operación',
    'Pagado a',
  ];
  if (includeUserColumn) {
    headers.push('Usuario');
  }
  headers.push('Duplicado');
  return headers;
}

function receiptToExportRow(receipt: Receipt, includeUserColumn: boolean): (string | number)[] {
  const row: (string | number)[] = [
    receipt.receiptId,
    receipt.isDownloaded ? 'Descargada' : 'Disponible',
    formatDateLima(receipt.createdAt),
    receipt.transactionSource ?? '',
    typeof receipt.transactionAmount === 'number' ? receipt.transactionAmount : '',
    formatDateLima(receipt.transactionDateTimeUtc),
    receipt.transactionOperationNumber ?? '',
    receipt.payeeName ?? '',
  ];
  if (includeUserColumn) {
    row.push(receipt.userName ?? '');
  }
  row.push(receipt.parentReceiptId ? 'Sí' : 'No');
  return row;
}

function buildStyledExcelWorkbook(
  headers: string[],
  rows: (string | number)[][],
  meta: { selectedDate: string; recordCount: number },
) {
  const importeColumnIndex = 4;
  const metaRows: (string | number)[][] = [
    ['Reporte de Vouchers — VouChek'],
    [`Generado: ${formatDateLima(new Date().toISOString())}`],
    [`Fecha consultada: ${meta.selectedDate}`],
    [`Total de registros: ${meta.recordCount}`],
    [],
  ];
  const sheetData = [...metaRows, headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const headerRowIndex = metaRows.length;
  const importeColumnLetter = XLSX.utils.encode_col(importeColumnIndex);

  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } },
  ];
  worksheet['!cols'] = headers.map((header, index) => {
    if (index === importeColumnIndex) return { wch: 14 };
    if (header === 'ID Voucher') return { wch: 38 };
    if (header === 'Fecha de Captura' || header === 'Fecha Operación') return { wch: 22 };
    if (header === 'Pagado a' || header === 'Usuario') return { wch: 28 };
    return { wch: Math.min(Math.max(header.length + 4, 12), 32) };
  });
  worksheet['!freeze'] = { xSplit: 0, ySplit: headerRowIndex + 1, topLeftCell: 'A1', activePane: 'bottomLeft' };
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: headerRowIndex + rows.length, c: headers.length - 1 },
    }),
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const cellAddress = `${importeColumnLetter}${headerRowIndex + 2 + rowIndex}`;
    const value = rows[rowIndex][importeColumnIndex];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      worksheet[cellAddress] = { t: 'n', v: value, z: '"S/ "#,##0.00' };
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vouchers');
  return workbook;
}

function getVisiblePages(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortDirection,
  onSort,
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
}) {
  const active = sortBy === column;
  return (
    <TableHead
      className="cursor-pointer whitespace-nowrap select-none"
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active &&
          (sortDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4 shrink-0" />
          ) : (
            <ArrowDown className="h-4 w-4 shrink-0" />
          ))}
      </span>
    </TableHead>
  );
}

export default function ReceiptsTable({
  isSuperAdmin = false,
  ownReceiptsOnly = false,
  lockedUserId,
  initialCustomerId = '',
  initialDate,
  initialTimezoneOffsetMinutes,
  initialTransactionSource,
  initialUserId,
  initialUserName,
  initialReceiptsPage,
}: {
  isSuperAdmin?: boolean;
  ownReceiptsOnly?: boolean;
  lockedUserId?: string;
  initialCustomerId?: string;
  initialDate?: string;
  initialTimezoneOffsetMinutes?: number;
  initialTransactionSource?: string;
  initialUserId?: string;
  initialUserName?: string;
  initialReceiptsPage?: ReceiptPage;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedInitialDate = normalizeWorkDate(initialDate);
  const normalizedInitialTimezoneOffsetMinutes =
    typeof initialTimezoneOffsetMinutes === 'number'
      ? initialTimezoneOffsetMinutes
      : new Date(`${normalizedInitialDate}T00:00:00`).getTimezoneOffset();

  const [selectedOrg, setSelectedOrg] = useState<string>(initialCustomerId);
  const [currentPage, setCurrentPage] = useState(1);
  const [receiptPage, setReceiptPage] = useState<ReceiptPage>(
    initialReceiptsPage && initialReceiptsPage.customerId === selectedOrg
      ? initialReceiptsPage
      : buildEmptyPage(selectedOrg, currentPage)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [ocrModal, setOcrModal] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [userFilter, setUserFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(normalizedInitialDate);
  const [selectedTransactionSource, setSelectedTransactionSource] = useState<string | null>(
    initialTransactionSource ?? null
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    ownReceiptsOnly && lockedUserId ? lockedUserId : (initialUserId ?? null),
  );
  const [selectedUserName, setSelectedUserName] = useState<string | null>(
    initialUserName ?? null
  );
  const [showDuplicates, setShowDuplicates] = useState(false);

  const canHydrateInitialCache =
    !!selectedOrg &&
    !!initialReceiptsPage &&
    typeof initialTimezoneOffsetMinutes === 'number';
  const initialCacheKey = canHydrateInitialCache
    ? buildCacheKey(
        selectedOrg,
        1,
        normalizedInitialDate,
        normalizedInitialTimezoneOffsetMinutes,
        initialTransactionSource ?? null,
        initialUserId ?? null
      )
    : null;
  const pageCacheRef = useRef<Record<string, ReceiptPage>>(
    initialCacheKey && initialReceiptsPage ? { [initialCacheKey]: initialReceiptsPage } : {}
  );
  const lastKnownUpdateRef = useRef<Record<string, string | null>>(
    selectedOrg && initialReceiptsPage
      ? { [selectedOrg]: initialReceiptsPage.lastUpdatedAt ?? null }
      : {}
  );
  const activeRequestKeyRef = useRef<string | null>(null);

  function buildEmptyPage(customerId: string, page: number): ReceiptPage {
    return {
      customerId,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      hasMore: false,
      lastUpdatedAt: null,
      receipts: [],
      totalCount: 0,
    };
  }

  function buildCacheKey(
    customerId: string,
    page: number,
    date: string,
    timezoneOffsetMinutes: number,
    transactionSource: string | null,
    userId: string | null
  ): string {
    return `${customerId}:${date}:${timezoneOffsetMinutes}:${transactionSource ?? 'all'}:${userId ?? 'all'}:${page}`;
  }

  function getTimezoneOffsetMinutes(date: string): number {
    if (date === normalizedInitialDate) {
      return normalizedInitialTimezoneOffsetMinutes;
    }
    return new Date(`${date}T00:00:00`).getTimezoneOffset();
  }

  function updateUrlParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function formatLastUpdated(lastUpdatedAt: string | null): string {
    if (!lastUpdatedAt) {
      return 'Sin datos aún';
    }
    return new Date(lastUpdatedAt).toLocaleString();
  }

  function clearOrgCache(customerId: string) {
    Object.keys(pageCacheRef.current).forEach((key) => {
      if (key.startsWith(`${customerId}:`)) {
        delete pageCacheRef.current[key];
      }
    });
  }

  async function loadReceiptsPage(
    customerId: string,
    page: number,
    options: LoadReceiptsOptions = {}
  ) {
    if (!customerId) {
      setReceiptPage(buildEmptyPage(customerId, page));
      setError(null);
      return;
    }

    const selectedTimezoneOffsetMinutes = getTimezoneOffsetMinutes(selectedDate);
    const cacheKey = buildCacheKey(
      customerId,
      page,
      selectedDate,
      selectedTimezoneOffsetMinutes,
      selectedTransactionSource,
      selectedUserId
    );
    const cachedPage = pageCacheRef.current[cacheKey];
    if (!options.forceRefresh && cachedPage) {
      setReceiptPage(cachedPage);
      setError(null);
      lastKnownUpdateRef.current[customerId] = cachedPage.lastUpdatedAt ?? null;
      return;
    }

    const requestKey = `${cacheKey}:${options.forceRefresh ? 'refresh' : 'load'}:${Date.now()}`;
    activeRequestKeyRef.current = requestKey;
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        customerId,
        page: String(page),
        pageSize: String(DEFAULT_PAGE_SIZE),
        date: selectedDate,
        timezoneOffsetMinutes: String(selectedTimezoneOffsetMinutes),
      });

      if (selectedTransactionSource) {
        query.set('transactionSource', selectedTransactionSource);
      }

      if (ownReceiptsOnly && lockedUserId) {
        query.set('userId', lockedUserId);
      } else if (selectedUserId) {
        query.set('userId', selectedUserId);
      }

      if (options.forceRefresh) {
        query.set('refresh', '1');
      }

      const response = await fetch(`/api/receipts?${query.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo cargar vouchers.');
      }

      const nextPage = {
        customerId: String(data?.customerId ?? customerId),
        page: Number(data?.page ?? page),
        pageSize: Number(data?.pageSize ?? DEFAULT_PAGE_SIZE),
        hasMore: Boolean(data?.hasMore),
        lastUpdatedAt: data?.lastUpdatedAt ?? null,
        receipts: Array.isArray(data?.receipts) ? data.receipts : [],
        totalCount: Number(data?.totalCount ?? 0),
      } satisfies ReceiptPage;

      pageCacheRef.current[cacheKey] = nextPage;
      lastKnownUpdateRef.current[customerId] = nextPage.lastUpdatedAt ?? null;

      if (activeRequestKeyRef.current === requestKey) {
        setReceiptPage(nextPage);
        setError(null);
      }
    } catch (err) {
      if (activeRequestKeyRef.current === requestKey) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    } finally {
      if (activeRequestKeyRef.current === requestKey) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const urlDate = normalizeWorkDate(searchParams.get('date'));
    if (urlDate !== selectedDate) {
      setSelectedDate(urlDate);
      setCurrentPage(1);
      setRefreshNotice(null);
      setHighlightedRow(null);
    }
  }, [searchParams, selectedDate]);

  useEffect(() => {
    const urlCustomerId = searchParams.get(WORK_CUSTOMER_ID_PARAM)?.trim() ?? '';
    if (urlCustomerId && urlCustomerId !== selectedOrg) {
      setSelectedOrg(urlCustomerId);
      setCurrentPage(1);
      setRefreshNotice(null);
      setHighlightedRow(null);
    }
  }, [searchParams, selectedOrg]);

  useEffect(() => {
    if (selectedOrg) {
      void loadReceiptsPage(selectedOrg, currentPage);
    }
  }, [selectedOrg, currentPage, selectedDate, selectedTransactionSource, selectedUserId]);

  useEffect(() => {
    if (!selectedOrg) return;

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/receipts/summary?customerId=${selectedOrg}`, {
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data) return;

        const lastUpdatedAt = data.lastUpdatedAt;
        const previousLastUpdatedAt = lastKnownUpdateRef.current[selectedOrg];

        if (lastUpdatedAt && lastUpdatedAt !== previousLastUpdatedAt) {
          setRefreshNotice('Nuevos vouchers disponibles. Actualizando...');
          lastKnownUpdateRef.current[selectedOrg] = lastUpdatedAt;
          void loadReceiptsPage(selectedOrg, 1, { forceRefresh: true });
        }
      } catch {
        // Ignore background polling errors.
      }
    }, INVALIDATION_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedOrg, selectedDate]);

  function refreshCurrentPage() {
    if (!selectedOrg) {
      return;
    }

    clearOrgCache(selectedOrg);
    setRefreshNotice(null);
    void loadReceiptsPage(selectedOrg, currentPage, { forceRefresh: true });
  }

  function clearTransactionSourceFilter() {
    setSelectedTransactionSource(null);
    setCurrentPage(1);
    updateUrlParam('transactionSource', null);
  }

  function clearUserFilter() {
    if (ownReceiptsOnly) return;
    setSelectedUserId(null);
    setSelectedUserName(null);
    setCurrentPage(1);
    updateUrlParam('userId', null);
    updateUrlParam('userName', null);
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  }

  let filteredReceipts = receiptPage.receipts;
  if (!showDuplicates) {
    filteredReceipts = filteredReceipts.filter((r) => !r.parentReceiptId);
  }

  if (userFilter.trim()) {
    const q = userFilter.trim().toLowerCase();
    filteredReceipts = filteredReceipts.filter((r) => {
      return (
        r.userName?.toLowerCase().includes(q) ||
        r.transactionSource?.toLowerCase().includes(q) ||
        r.transactionOperationNumber?.toLowerCase().includes(q) ||
        r.payeeName?.toLowerCase().includes(q) ||
        (r.transactionAmount && String(r.transactionAmount).toLowerCase().includes(q)) ||
        (r.createdAt && new Date(r.createdAt).toLocaleString().toLowerCase().includes(q)) ||
        (r.transactionDateTimeUtc &&
          new Date(r.transactionDateTimeUtc).toLocaleString().toLowerCase().includes(q))
      );
    });
  }

  const sorters: Record<string, (a: Receipt, b: Receipt) => number> = {
    createdAt: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    transactionSource: (a, b) =>
      (a.transactionSource || '').localeCompare(b.transactionSource || ''),
    transactionAmount: (a, b) =>
      Number(a.transactionAmount || 0) - Number(b.transactionAmount || 0),
    transactionDateTimeUtc: (a, b) =>
      new Date(a.transactionDateTimeUtc || 0).getTime() -
      new Date(b.transactionDateTimeUtc || 0).getTime(),
    transactionOperationNumber: (a, b) =>
      (a.transactionOperationNumber || '').localeCompare(b.transactionOperationNumber || ''),
    payeeName: (a, b) => (a.payeeName || '').localeCompare(b.payeeName || ''),
    userName: (a, b) => (a.userName || '').localeCompare(b.userName || ''),
  };
  const sortedReceipts = [...filteredReceipts];
  if (sortBy && sorters[sortBy]) {
    sortedReceipts.sort(sorters[sortBy]);
    if (sortDirection === 'desc') sortedReceipts.reverse();
  }

  const totalPages = Math.max(1, Math.ceil((receiptPage.totalCount ?? 0) / receiptPage.pageSize));
  const showPagination = totalPages > 1;
  const columnCount = 7 + (ownReceiptsOnly ? 0 : 1) + (isSuperAdmin ? 1 : 0);

  async function buildExportData(): Promise<{
    headers: string[];
    sortedReceipts: Receipt[];
    includeUserColumn: boolean;
    recordCount: number;
  } | null> {
    if (!selectedOrg) return null;
    let allReceipts: Receipt[] = [];
    try {
      allReceipts = await fetchReceipts(selectedOrg, {
        forceRefresh: true,
        date: selectedDate,
        timezoneOffsetMinutes: getTimezoneOffsetMinutes(selectedDate),
        transactionSource: selectedTransactionSource ?? undefined,
        userId: ownReceiptsOnly && lockedUserId ? lockedUserId : (selectedUserId ?? undefined),
      });
    } catch {
      return null;
    }

    const q = userFilter.trim().toLowerCase();
    let filtered = showDuplicates
      ? allReceipts
      : allReceipts.filter((r) => !r.parentReceiptId);
    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.userName?.toLowerCase().includes(q) ||
          r.transactionSource?.toLowerCase().includes(q) ||
          r.transactionOperationNumber?.toLowerCase().includes(q) ||
          r.payeeName?.toLowerCase().includes(q) ||
          (r.transactionAmount && String(r.transactionAmount).toLowerCase().includes(q)) ||
          (r.createdAt && new Date(r.createdAt).toLocaleString().toLowerCase().includes(q)) ||
          (r.transactionDateTimeUtc &&
            new Date(r.transactionDateTimeUtc).toLocaleString().toLowerCase().includes(q))
      );
    }

    const exportSorters: Record<string, (a: Receipt, b: Receipt) => number> = {
      createdAt: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      transactionSource: (a, b) =>
        (a.transactionSource || '').localeCompare(b.transactionSource || ''),
      transactionAmount: (a, b) =>
        Number(a.transactionAmount || 0) - Number(b.transactionAmount || 0),
      transactionDateTimeUtc: (a, b) =>
        new Date(a.transactionDateTimeUtc || 0).getTime() -
        new Date(b.transactionDateTimeUtc || 0).getTime(),
      transactionOperationNumber: (a, b) =>
        (a.transactionOperationNumber || '').localeCompare(b.transactionOperationNumber || ''),
      payeeName: (a, b) => (a.payeeName || '').localeCompare(b.payeeName || ''),
      userName: (a, b) => (a.userName || '').localeCompare(b.userName || ''),
    };
    const sorted = [...filtered];
    if (sortBy && exportSorters[sortBy]) {
      sorted.sort(exportSorters[sortBy]);
      if (sortDirection === 'desc') sorted.reverse();
    }

    const includeUserColumn = !ownReceiptsOnly;
    const headers = buildExportHeaders(includeUserColumn);

    return {
      headers,
      sortedReceipts: sorted,
      includeUserColumn,
      recordCount: sorted.length,
    };
  }

  async function exportToExcel() {
    const exportData = await buildExportData();
    if (!exportData) {
      alert('No se pudo obtener todos los vouchers para exportar a Excel.');
      return;
    }

    const { headers, sortedReceipts, includeUserColumn, recordCount } = exportData;
    const rowsForExcel = sortedReceipts.map((receipt) =>
      receiptToExportRow(receipt, includeUserColumn),
    );

    const workbook = buildStyledExcelWorkbook(headers, rowsForExcel, {
      selectedDate,
      recordCount,
    });
    XLSX.writeFile(workbook, `vouchers_${selectedDate}.xlsx`);
  }

  async function exportToPdf() {
    const exportData = await buildExportData();
    if (!exportData) {
      alert('No se pudo obtener todos los vouchers para exportar a PDF.');
      return;
    }

    const { headers, sortedReceipts, includeUserColumn, recordCount } = exportData;
    const rows = sortedReceipts.map((receipt) => {
      const row = receiptToExportRow(receipt, includeUserColumn);
      row[4] = formatCurrencyPen(
        typeof receipt.transactionAmount === 'number' ? receipt.transactionAmount : null,
      );
      return row;
    });
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Reporte de Vouchers — VouChek', 14, 14);
    doc.setFontSize(9);
    doc.text(`Generado: ${formatDateLima(new Date().toISOString())}`, 14, 21);
    doc.text(`Fecha consultada: ${selectedDate} · ${recordCount} registro(s)`, 14, 27);
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 32,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [39, 110, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 32, right: 10, bottom: 10, left: 10 },
    });
    doc.save(`vouchers_${selectedDate}.pdf`);
  }

  const paginationLabel = (() => {
    const start = (currentPage - 1) * receiptPage.pageSize + 1;
    const end = start + receiptPage.receipts.length - 1;
    const total = receiptPage.totalCount ?? 0;
    if (total === 0) return 'Sin vouchers';
    return `${start}–${end} de ${total} vouchers`;
  })();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1.5 sm:max-w-xs">
          <Label htmlFor="receipts-search">Buscar en columnas</Label>
          <Input
            id="receipts-search"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Buscar por usuario, origen, pagado a, importe, fecha, operación..."
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Checkbox
            id="show-duplicates"
            checked={showDuplicates}
            onCheckedChange={(checked) => setShowDuplicates(checked === true)}
          />
          <Label htmlFor="show-duplicates" className="cursor-pointer font-normal">
            Mostrar duplicados
          </Label>
        </div>

        <Button
          type="button"
          variant="soft"
          color="info"
          size="icon"
          onClick={() => void exportToExcel()}
          title="Exportar Excel"
          aria-label="Exportar Excel"
        >
          <FileSpreadsheet className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="soft"
          color="destructive"
          size="icon"
          onClick={() => void exportToPdf()}
          title="Exportar PDF"
          aria-label="Exportar PDF"
        >
          <FileType2 className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="soft"
          color="primary"
          onClick={refreshCurrentPage}
          disabled={!selectedOrg || loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Actualizar
        </Button>

        <p className="pb-1 text-sm text-default-500">
          Última actualización: {formatLastUpdated(receiptPage.lastUpdatedAt)}
        </p>
      </div>

      {(selectedTransactionSource || (selectedUserId && !ownReceiptsOnly)) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selectedTransactionSource && (
            <Badge color="primary" className="gap-1.5 pr-1.5">
              Origen: {selectedTransactionSource}
              <button
                type="button"
                className="rounded-sm opacity-70 hover:opacity-100"
                onClick={clearTransactionSourceFilter}
                aria-label="Quitar filtro de origen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          )}
          {selectedUserId && !ownReceiptsOnly && (
            <Badge color="primary" className="gap-1.5 pr-1.5">
              Usuario: {selectedUserName ?? selectedUserId}
              <button
                type="button"
                className="rounded-sm opacity-70 hover:opacity-100"
                onClick={clearUserFilter}
                aria-label="Quitar filtro de usuario"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {refreshNotice && (
        <Alert color="success" className="mb-4">
          <AlertDescription>{refreshNotice}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert color="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-md border border-default-200 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voucher</TableHead>
              <SortableHeader
                label="Fecha de Captura"
                column="createdAt"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Origen"
                column="transactionSource"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Importe"
                column="transactionAmount"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Fecha Operación"
                column="transactionDateTimeUtc"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Nº Operación"
                column="transactionOperationNumber"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Pagado a"
                column="payeeName"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              {!ownReceiptsOnly && (
              <SortableHeader
                label="Usuario"
                column="userName"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              )}
              {isSuperAdmin && <TableHead>Texto</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && sortedReceipts.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-10 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Cargando vouchers...</span>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!loading && sortedReceipts.length === 0 && !error && (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="py-10 text-center text-default-500"
                >
                  No hay vouchers para esta empresa.
                </TableCell>
              </TableRow>
            )}

            {sortedReceipts.map((receipt) => {
              const isHighlighted = highlightedRow === receipt.receiptId;
              const isDuplicateReceipt = Boolean(receipt.parentReceiptId);
              return (
                <TableRow
                  key={`${receipt.userId}:${receipt.receiptId}`}
                  className={cn(
                    'cursor-pointer',
                    isDuplicateReceipt &&
                      (isHighlighted ? 'bg-destructive/15' : 'bg-destructive/5'),
                    !isDuplicateReceipt &&
                      isHighlighted &&
                      'bg-warning/15'
                  )}
                  onClick={() => setHighlightedRow(receipt.receiptId)}
                >
                  <TableCell className="normal-case">
                    {receipt.hasImage ? (
                      <img
                        src={`/api/receipt-image/${receipt.userId}/${receipt.receiptId}`}
                        alt="Miniatura del voucher"
                        className="h-[30px] w-[45px] cursor-pointer rounded border border-default-200 object-cover"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageModal(
                            `/api/receipt-image/${receipt.userId}/${receipt.receiptId}`
                          );
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src =
                            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDUiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCA0NSAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ1IiBoZWlnaHQ9IjMwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjIyLjUiIHk9IjE1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzlhYTNmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
                        }}
                      />
                    ) : (
                      <span className="text-sm text-default-500">Sin imagen</span>
                    )}
                    {isDuplicateReceipt && (
                      <Badge color="destructive" className="mt-1.5 text-xs">
                        Duplicado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="normal-case">
                    {new Date(receipt.createdAt).toLocaleString('es-PE', {
                      timeZone: 'America/Lima',
                    })}
                  </TableCell>
                  <TableCell className="normal-case">
                    {receipt.transactionSource ?? ''}
                  </TableCell>
                  <TableCell className="normal-case">
                    {formatCurrencyPen(receipt.transactionAmount)}
                  </TableCell>
                  <TableCell className="normal-case">
                    {receipt.transactionDateTimeUtc
                      ? new Date(receipt.transactionDateTimeUtc).toLocaleString('es-PE', {
                          timeZone: 'America/Lima',
                        })
                      : ''}
                  </TableCell>
                  <TableCell className="normal-case">
                    {receipt.transactionOperationNumber ?? ''}
                  </TableCell>
                  <TableCell className="normal-case">{receipt.payeeName ?? ''}</TableCell>
                  {!ownReceiptsOnly && (
                  <TableCell className="normal-case text-default-500">
                    {receipt.userName}
                  </TableCell>
                  )}
                  {isSuperAdmin && (
                    <TableCell className="normal-case">
                      <Button
                        type="button"
                        size="sm"
                        variant="soft"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOcrModal(receipt.ocrText ?? 'No hay texto OCR disponible.');
                        }}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Ver OCR
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-default-500">{paginationLabel}</p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {getVisiblePages(currentPage, totalPages).map((page, index, arr) => {
              const prev = arr[index - 1];
              const showEllipsis = prev !== undefined && page - prev > 1;
              return (
                <span key={page} className="flex items-center gap-1">
                  {showEllipsis && (
                    <span className="px-1 text-default-500">…</span>
                  )}
                  <Button
                    type="button"
                    variant={page === currentPage ? 'shadow' : 'outline'}
                    size="sm"
                    className="h-9 min-w-9"
                    disabled={loading}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                </span>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!imageModal} onOpenChange={(open) => !open && setImageModal(null)}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>Imagen del Voucher</DialogTitle>
          </DialogHeader>
          {imageModal && (
            <div className="flex max-h-[70vh] justify-center overflow-auto">
              <img
                src={imageModal}
                alt="Voucher"
                className="h-auto w-auto max-w-full rounded-md object-contain"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  img.style.width = `${Math.round(img.naturalWidth / 2)}px`;
                  img.style.height = `${Math.round(img.naturalHeight / 2)}px`;
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!ocrModal} onOpenChange={(open) => !open && setOcrModal(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Texto OCR</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm text-default-600">{ocrModal}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
