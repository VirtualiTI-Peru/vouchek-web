'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DatePickerInput } from '@mantine/dates';
import {
  Badge,
  Table,
  Button,
  Select,
  Modal,
  Text,
  Group,
  Pagination,
  Alert,
  Loader,
  ActionIcon,
  TextInput,
} from '@mantine/core';
import { IconRefresh, IconEye, IconPhoto, IconSortAscending, IconSortDescending, IconDownload } from '@tabler/icons-react';
import type { Receipt, ReceiptPage } from '@/lib/api-types';
import { fetchReceipts } from '@/lib/webapi-client';

type Org = { id: string; name: string };

type LoadReceiptsOptions = {
  forceRefresh?: boolean;
};

const DEFAULT_PAGE_SIZE = Number(process.env.NEXT_PUBLIC_RECEIPTS_PAGE_SIZE) || 50;
const INVALIDATION_POLL_MS = Number(process.env.NEXT_PUBLIC_RECEIPTS_POLL_MS) || 15000;

const formatCurrencyPen = (amount?: number | null) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return '';
  }

  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount);
};

export default function ReceiptsTable({
  organizations,
  showOrganizationSelector = true,
  isSuperAdmin = false,
  initialDate,
  initialTimezoneOffsetMinutes,
  initialTransactionSource,
  initialUserId,
  initialUserName,
  initialReceiptsPage,
}: {
  organizations: Org[];
  showOrganizationSelector?: boolean;
  isSuperAdmin?: boolean;
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
  const today = new Date().toISOString().slice(0, 10);
  const normalizedInitialDate = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
    ? initialDate
    : today;
  const normalizedInitialTimezoneOffsetMinutes = typeof initialTimezoneOffsetMinutes === 'number'
    ? initialTimezoneOffsetMinutes
    : new Date(`${normalizedInitialDate}T00:00:00`).getTimezoneOffset();

  const [selectedOrg, setSelectedOrg] = useState<string>(organizations[0]?.id ?? '');
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
  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [userFilter, setUserFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(normalizedInitialDate);
  const [selectedTransactionSource, setSelectedTransactionSource] = useState<string | null>(initialTransactionSource ?? null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId ?? null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(initialUserName ?? null);

  // Cache and polling refs
  const initialCacheKey = selectedOrg
    ? buildCacheKey(selectedOrg, 1, normalizedInitialDate, initialTransactionSource ?? null, initialUserId ?? null)
    : null;
  const pageCacheRef = useRef<Record<string, ReceiptPage>>(
    initialCacheKey && initialReceiptsPage
      ? { [initialCacheKey]: initialReceiptsPage }
      : {}
  );
  const lastKnownUpdateRef = useRef<Record<string, string | null>>(
    selectedOrg && initialReceiptsPage
      ? { [selectedOrg]: initialReceiptsPage.lastUpdatedAt ?? null }
      : {}
  );
  const activeRequestKeyRef = useRef<string | null>(null);

  function formatDateLocal(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getTimezoneOffsetMinutes(date: string): number {
    if (date === normalizedInitialDate) {
      return normalizedInitialTimezoneOffsetMinutes;
    }
    return new Date(`${date}T00:00:00`).getTimezoneOffset();
  }

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

  function buildCacheKey(customerId: string, page: number, date: string, transactionSource: string | null, userId: string | null): string {
    return `${customerId}:${date}:${transactionSource ?? 'all'}:${userId ?? 'all'}:${page}`;
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
      return 'Nunca';
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

  async function loadReceiptsPage(customerId: string, page: number, options: LoadReceiptsOptions = {}) {
    if (!customerId) {
      setReceiptPage(buildEmptyPage(customerId, page));
      setError(null);
      return;
    }

    const cacheKey = buildCacheKey(customerId, page, selectedDate, selectedTransactionSource, selectedUserId);
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
      const searchParams = new URLSearchParams({
        customerId,
        page: String(page),
        pageSize: String(DEFAULT_PAGE_SIZE),
        date: selectedDate,
        timezoneOffsetMinutes: String(getTimezoneOffsetMinutes(selectedDate)),
      });

      if (selectedTransactionSource) {
        searchParams.set('transactionSource', selectedTransactionSource);
      }

      if (selectedUserId) {
        searchParams.set('userId', selectedUserId);
      }

      if (options.forceRefresh) {
        searchParams.set('refresh', '1');
      }

      const response = await fetch(`/api/receipts?${searchParams.toString()}`, {
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

  // Initial load
  useEffect(() => {
    if (selectedOrg) {
      void loadReceiptsPage(selectedOrg, currentPage);
    }
  }, [selectedOrg, currentPage, selectedDate, selectedTransactionSource, selectedUserId]);

  // Background polling for updates
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

  function handleOrganizationChange(nextOrgId: string) {
    setSelectedOrg(nextOrgId);
    setCurrentPage(1);
    setRefreshNotice(null);
    setHighlightedRow(null);
  }

  function handleDateChange(value: Date | null) {
    if (!value) {
      return;
    }

    const iso = formatDateLocal(value);
    setSelectedDate(iso);

    const params = new URLSearchParams(searchParams.toString());
    params.set('date', iso);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    setCurrentPage(1);
    setRefreshNotice(null);
    setHighlightedRow(null);
  }

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
    setSelectedUserId(null);
    setSelectedUserName(null);
    setCurrentPage(1);
    updateUrlParam('userId', null);
    updateUrlParam('userName', null);
  }


  // Sorting handler (must be before return)
  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  }

  // Filtering: single search box for all sortable columns
  let filteredReceipts = receiptPage.receipts;
  if (userFilter.trim()) {
    const q = userFilter.trim().toLowerCase();
    filteredReceipts = filteredReceipts.filter(r => {
      return (
        (r.userName?.toLowerCase().includes(q)) ||
        (r.transactionSource?.toLowerCase().includes(q)) ||
        (r.transactionOperationNumber?.toLowerCase().includes(q)) ||
        (r.transactionAmount && String(r.transactionAmount).toLowerCase().includes(q)) ||
        (r.createdAt && new Date(r.createdAt).toLocaleString().toLowerCase().includes(q)) ||
        (r.transactionDateTimeUtc && new Date(r.transactionDateTimeUtc).toLocaleString().toLowerCase().includes(q))
      );
    });
  }

  // Sorting
  const sorters: Record<string, (a: any, b: any) => number> = {
    createdAt: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    transactionSource: (a, b) => (a.transactionSource || '').localeCompare(b.transactionSource || ''),
    transactionAmount: (a, b) => Number(a.transactionAmount || 0) - Number(b.transactionAmount || 0),
    transactionDateTimeUtc: (a, b) => new Date(a.transactionDateTimeUtc || 0).getTime() - new Date(b.transactionDateTimeUtc || 0).getTime(),
    transactionOperationNumber: (a, b) => (a.transactionOperationNumber || '').localeCompare(b.transactionOperationNumber || ''),
    userName: (a, b) => (a.userName || '').localeCompare(b.userName || ''),
  };
  let sortedReceipts = [...filteredReceipts];
  if (sortBy && sorters[sortBy]) {
    sortedReceipts.sort(sorters[sortBy]);
    if (sortDirection === 'desc') sortedReceipts.reverse();
  }
  // Calculate total pages from totalCount and pageSize
  const totalPages = Math.max(1, Math.ceil((receiptPage.totalCount ?? 0) / receiptPage.pageSize));
  const showPagination = totalPages > 1;


  // CSV export handler (fetches all data, filters and sorts client-side)
  async function exportToCsv() {
    if (!selectedOrg) return;
    let allReceipts: Receipt[] = [];
    try {
      allReceipts = await fetchReceipts(selectedOrg, {
        forceRefresh: true,
        date: selectedDate,
        timezoneOffsetMinutes: getTimezoneOffsetMinutes(selectedDate),
        transactionSource: selectedTransactionSource ?? undefined,
        userId: selectedUserId ?? undefined,
      });
    } catch {
      alert('No se pudo obtener todos los vouchers para exportar.');
      return;
    }
    // Apply current filter
    const q = userFilter.trim().toLowerCase();
    let filtered = allReceipts;
    if (q) {
      filtered = filtered.filter(r =>
        (r.userName?.toLowerCase().includes(q)) ||
        (r.transactionSource?.toLowerCase().includes(q)) ||
        (r.transactionOperationNumber?.toLowerCase().includes(q)) ||
        (r.transactionAmount && String(r.transactionAmount).toLowerCase().includes(q)) ||
        (r.createdAt && new Date(r.createdAt).toLocaleString().toLowerCase().includes(q)) ||
        (r.transactionDateTimeUtc && new Date(r.transactionDateTimeUtc).toLocaleString().toLowerCase().includes(q))
      );
    }
    // Apply current sort
    const sorters: Record<string, (a: any, b: any) => number> = {
      createdAt: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      transactionSource: (a, b) => (a.transactionSource || '').localeCompare(b.transactionSource || ''),
      transactionAmount: (a, b) => Number(a.transactionAmount || 0) - Number(b.transactionAmount || 0),
      transactionDateTimeUtc: (a, b) => new Date(a.transactionDateTimeUtc || 0).getTime() - new Date(b.transactionDateTimeUtc || 0).getTime(),
      transactionOperationNumber: (a, b) => (a.transactionOperationNumber || '').localeCompare(b.transactionOperationNumber || ''),
      userName: (a, b) => (a.userName || '').localeCompare(b.userName || ''),
    };
    let sorted = [...filtered];
    if (sortBy && sorters[sortBy]) {
      sorted.sort(sorters[sortBy]);
      if (sortDirection === 'desc') sorted.reverse();
    }
    // Only export sortable/filterable columns
    const headers = [
      'Fecha de Captura',
      'Origen',
      'Importe',
      'Fecha Operación',
      'Nº Operación',
      'Usuario'
    ];
    const rows = sorted.map(r => [
      r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
      r.transactionSource ?? '',
      r.transactionAmount ?? '',
      r.transactionDateTimeUtc ? new Date(r.transactionDateTimeUtc).toLocaleString() : '',
      r.transactionOperationNumber ?? '',
      r.userName ?? ''
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipts.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  return (
    <>
      <Group mb="md" gap="sm" align="end">
        <DatePickerInput
          label="Fecha"
          value={new Date(`${selectedDate}T00:00:00`)}
          onChange={handleDateChange}
          maw={180}
        />
        <TextInput
          label="Buscar en columnas"
          value={userFilter}
          onChange={e => setUserFilter(e.currentTarget.value)}
          placeholder="Buscar por usuario, origen, importe, fecha, operación..."
          style={{ maxWidth: 320 }}
        />
        <ActionIcon
          variant="light"
          color="blue"
          onClick={exportToCsv}
          title="Exportar CSV"
          aria-label="Exportar CSV"
          size="lg"
          style={{ marginBottom: 4 }}
        >
          <IconDownload size={20} />
        </ActionIcon>
        {showOrganizationSelector && (
          <Select
            data={organizations.map((org) => ({ value: org.id, label: org.name }))}
            value={selectedOrg}
            onChange={(value) => value && handleOrganizationChange(value)}
            disabled={organizations.length <= 1}
            placeholder="Seleccionar organización"
            style={{ minWidth: 200 }}
          />
        )}

        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={refreshCurrentPage}
          disabled={!selectedOrg || loading}
          loading={loading}
          variant="light"
        >
          Actualizar
        </Button>

        <Text size="sm" c="dimmed">
          Última actualización: {formatLastUpdated(receiptPage.lastUpdatedAt)}
        </Text>
      </Group>

      {(selectedTransactionSource || selectedUserId) && (
        <Group mb="md" gap="sm">
          {selectedTransactionSource && (
            <Badge variant="light" size="lg" rightSection={<ActionIcon size="xs" variant="transparent" onClick={clearTransactionSourceFilter}>x</ActionIcon>}>
              Origen: {selectedTransactionSource}
            </Badge>
          )}
          {selectedUserId && (
            <Badge variant="light" size="lg" rightSection={<ActionIcon size="xs" variant="transparent" onClick={clearUserFilter}>x</ActionIcon>}>
              Usuario: {selectedUserName ?? selectedUserId}
            </Badge>
          )}
        </Group>
      )}

      {refreshNotice && (
        <Alert color="green" mb="md">
          {refreshNotice}
        </Alert>
      )}

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Voucher</Table.Th>
            <Table.Th
              style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={() => handleSort('createdAt')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Fecha de Captura
                {sortBy === 'createdAt' && (sortDirection === 'asc' ? <IconSortAscending size={16} style={{marginLeft: 2}} /> : <IconSortDescending size={16} style={{marginLeft: 2}} />)}
              </span>
            </Table.Th>
            <Table.Th
              style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={() => handleSort('transactionSource')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Origen
                {sortBy === 'transactionSource' && (sortDirection === 'asc' ? <IconSortAscending size={16} style={{marginLeft: 2}} /> : <IconSortDescending size={16} style={{marginLeft: 2}} />)}
              </span>
            </Table.Th>
            <Table.Th
              style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={() => handleSort('transactionAmount')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Importe
                {sortBy === 'transactionAmount' && (sortDirection === 'asc' ? <IconSortAscending size={16} style={{marginLeft: 2}} /> : <IconSortDescending size={16} style={{marginLeft: 2}} />)}
              </span>
            </Table.Th>
            <Table.Th
              style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={() => handleSort('transactionDateTimeUtc')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Fecha Operación
                {sortBy === 'transactionDateTimeUtc' && (sortDirection === 'asc' ? <IconSortAscending size={16} style={{marginLeft: 2}} /> : <IconSortDescending size={16} style={{marginLeft: 2}} />)}
              </span>
            </Table.Th>
            <Table.Th
              style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={() => handleSort('transactionOperationNumber')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Nº Operación
                {sortBy === 'transactionOperationNumber' && (sortDirection === 'asc' ? <IconSortAscending size={16} style={{marginLeft: 2}} /> : <IconSortDescending size={16} style={{marginLeft: 2}} />)}
              </span>
            </Table.Th>
            <Table.Th
              style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={() => handleSort('userName')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Usuario
                {sortBy === 'userName' && (sortDirection === 'asc' ? <IconSortAscending size={16} style={{marginLeft: 2}} /> : <IconSortDescending size={16} style={{marginLeft: 2}} />)}
              </span>
            </Table.Th>
            {isSuperAdmin && <Table.Th>Texto</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading && sortedReceipts.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={8} ta="center" py="xl">
                <Group justify="center">
                  <Loader size="sm" />
                  <Text>Cargando vouchers...</Text>
                </Group>
              </Table.Td>
            </Table.Tr>
          )}

          {!loading && sortedReceipts.length === 0 && !error && (
            <Table.Tr>
              <Table.Td colSpan={8} ta="center" py="xl" c="dimmed">
                No hay vouchers para esta organización.
              </Table.Td>
            </Table.Tr>
          )}

          {sortedReceipts.map((receipt) => {

              // Sorting handler (must be before return)
              function handleSort(column: string) {
                if (sortBy === column) {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy(column);
                  setSortDirection('asc');
                }
              }
            const isHighlighted = highlightedRow === receipt.receiptId;
            return (
              <Table.Tr
                key={`${receipt.userId}:${receipt.receiptId}`}
                bg={isHighlighted ? 'yellow.1' : undefined}
                onClick={() => setHighlightedRow(receipt.receiptId)}
                style={{ cursor: 'pointer' }}
              >
                <Table.Td>
                  {receipt.blobUrl ? (
                    <img
                      src={`/api/receipt-image/${receipt.userId}/${receipt.receiptId}`}
                      alt="Receipt thumbnail"
                      style={{
                        width: '45px',
                        height: '30px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        border: '1px solid #e9ecef'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageModal(`/api/receipt-image/${receipt.userId}/${receipt.receiptId}`);
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDUiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCA0NSAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ1IiBoZWlnaHQ9IjMwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjIyLjUiIHk9IjE1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzlhYTNmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
                      }}
                    />
                  ) : (
                    <Text c="dimmed" size="sm">Sin imagen</Text>
                  )}
                </Table.Td>
                <Table.Td>{new Date(receipt.createdAt).toLocaleString()}</Table.Td>
                <Table.Td>{receipt.transactionSource ?? ''}</Table.Td>
                <Table.Td>{formatCurrencyPen(receipt.transactionAmount)}</Table.Td>
                <Table.Td>
                  {receipt.transactionDateTimeUtc
                    ? new Date(receipt.transactionDateTimeUtc).toLocaleString()
                    : ''}
                </Table.Td>
                <Table.Td>{receipt.transactionOperationNumber ?? ''}</Table.Td>
                <Table.Td c="dimmed">{receipt.userName}</Table.Td>
                {isSuperAdmin && (
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconEye size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOcrModal(receipt.ocrText ?? 'No hay texto OCR disponible.');
                      }}
                    >
                      Ver OCR
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {showPagination && (
        <Group justify="space-between" align="center" mt="md" style={{ width: '100%' }}>
          <Text size="sm" c="dimmed" style={{ flex: 1, textAlign: 'left' }}>
            {(() => {
              const start = (currentPage - 1) * receiptPage.pageSize + 1;
              const end = start + receiptPage.receipts.length - 1;
              const total = receiptPage.totalCount ?? 0;
              if (total === 0) return 'Sin vouchers';
              return `${start}–${end} de ${total} vouchers`;
            })()}
          </Text>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={setCurrentPage}
              disabled={loading}
            />
          </div>
        </Group>
      )}

      {/* Image Modal */}
      <Modal
        opened={!!imageModal}
        onClose={() => setImageModal(null)}
        title="Imagen del Voucher"
        size="lg"
      >
        {imageModal && (
          <img
            src={imageModal}
            alt="Receipt"
            style={{ width: '100%', height: 'auto' }}
          />
        )}
      </Modal>

      {/* OCR Modal */}
      <Modal
        opened={!!ocrModal}
        onClose={() => setOcrModal(null)}
        title="Texto OCR"
        size="lg"
      >
        <Text style={{ whiteSpace: 'pre-wrap' }}>
          {ocrModal}
        </Text>
      </Modal>
    </>
  );
}