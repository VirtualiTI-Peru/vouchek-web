'use client';
import { useEffect, useRef, useState } from 'react';
import {
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
} from '@mantine/core';
import { IconRefresh, IconEye, IconPhoto } from '@tabler/icons-react';
import type { ReceiptPage } from '@/lib/api-types';

type Org = { id: string; name: string };

type LoadReceiptsOptions = {
  forceRefresh?: boolean;
};

const DEFAULT_PAGE_SIZE = Number(process.env.NEXT_PUBLIC_RECEIPTS_PAGE_SIZE) || 50;
const INVALIDATION_POLL_MS = 15_000;

export default function ReceiptsTable({
  organizations,
  showOrganizationSelector = true,
}: {
  organizations: Org[];
  showOrganizationSelector?: boolean;
}) {
  const [selectedOrg, setSelectedOrg] = useState<string>(organizations[0]?.id ?? '');
  const [currentPage, setCurrentPage] = useState(1);
  const [receiptPage, setReceiptPage] = useState<ReceiptPage>(
    buildEmptyPage(selectedOrg, currentPage)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [ocrModal, setOcrModal] = useState<string | null>(null);

  // Cache and polling refs
  const pageCacheRef = useRef<Record<string, ReceiptPage>>({});
  const lastKnownUpdateRef = useRef<Record<string, string | null>>({});
  const activeRequestKeyRef = useRef<string | null>(null);

  function buildEmptyPage(customerId: string, page: number): ReceiptPage {
    return {
      customerId,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      hasMore: false,
      lastUpdatedAt: null,
      receipts: [],
    };
  }

  function buildCacheKey(customerId: string, page: number): string {
    return `${customerId}:${page}`;
  }

  function formatLastUpdated(lastUpdatedAt: string | null): string {
    if (!lastUpdatedAt) {
      return 'Nunca';
    }
    return new Date(lastUpdatedAt).toLocaleString();
  }

  function clearOrgCache(orgId: string) {
    Object.keys(pageCacheRef.current).forEach((key) => {
      if (key.startsWith(`${orgId}:`)) {
        delete pageCacheRef.current[key];
      }
    });
  }

  async function loadReceiptsPage(orgId: string, page: number, options: LoadReceiptsOptions = {}) {
    if (!orgId) {
      setReceiptPage(buildEmptyPage(orgId, page));
      setError(null);
      return;
    }

    const cacheKey = buildCacheKey(orgId, page);
    const cachedPage = pageCacheRef.current[cacheKey];
    if (!options.forceRefresh && cachedPage) {
      setReceiptPage(cachedPage);
      setError(null);
      lastKnownUpdateRef.current[orgId] = cachedPage.lastUpdatedAt ?? null;
      return;
    }

    const requestKey = `${cacheKey}:${options.forceRefresh ? 'refresh' : 'load'}:${Date.now()}`;
    activeRequestKeyRef.current = requestKey;
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams({
        orgId,
        page: String(page),
        pageSize: String(DEFAULT_PAGE_SIZE),
      });

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
        customerId: String(data?.customerId ?? orgId),
        page: Number(data?.page ?? page),
        pageSize: Number(data?.pageSize ?? DEFAULT_PAGE_SIZE),
        hasMore: Boolean(data?.hasMore),
        lastUpdatedAt: data?.lastUpdatedAt ?? null,
        receipts: Array.isArray(data?.receipts) ? data.receipts : [],
      } satisfies ReceiptPage;

      pageCacheRef.current[cacheKey] = nextPage;
      lastKnownUpdateRef.current[orgId] = nextPage.lastUpdatedAt ?? null;

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
  }, [selectedOrg, currentPage]);

  // Background polling for updates
  useEffect(() => {
    if (!selectedOrg) return;

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/receipts/summary?orgId=${selectedOrg}`, {
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
  }, [selectedOrg]);

  function handleOrganizationChange(nextOrgId: string) {
    setSelectedOrg(nextOrgId);
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

  const receipts = receiptPage.receipts;
  // Show pagination if we're not on the first page (can go back) or if there are more pages (can go forward)
  const showPagination = currentPage > 1 || receiptPage.hasMore;

  return (
    <>
      <Group mb="md" gap="sm">
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
            <Table.Th>Fecha de Captura</Table.Th>
            <Table.Th>Origen</Table.Th>
            <Table.Th>Importe</Table.Th>
            <Table.Th>Fecha Operación</Table.Th>
            <Table.Th>Nº Operación</Table.Th>
            <Table.Th>Usuario</Table.Th>
            <Table.Th>Texto</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading && receipts.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={8} ta="center" py="xl">
                <Group justify="center">
                  <Loader size="sm" />
                  <Text>Cargando vouchers...</Text>
                </Group>
              </Table.Td>
            </Table.Tr>
          )}

          {!loading && receipts.length === 0 && !error && (
            <Table.Tr>
              <Table.Td colSpan={8} ta="center" py="xl" c="dimmed">
                No hay vouchers para esta organización.
              </Table.Td>
            </Table.Tr>
          )}

          {receipts.map((receipt) => {
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
                <Table.Td>{receipt.transactionAmount ?? ''}</Table.Td>
                <Table.Td>
                  {receipt.transactionDateTimeUtc
                    ? new Date(receipt.transactionDateTimeUtc).toLocaleString()
                    : ''}
                </Table.Td>
                <Table.Td>{receipt.transactionOperationNumber ?? ''}</Table.Td>
                <Table.Td c="dimmed">{receipt.userName}</Table.Td>
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
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {showPagination && (
        <Group justify="center" mt="md">
          <Pagination
            total={currentPage + (receiptPage.hasMore ? 1 : 0)}
            value={currentPage}
            onChange={(page) => {
              // Only allow navigation to pages we know exist
              if (page <= currentPage || receiptPage.hasMore) {
                setCurrentPage(page);
              }
            }}
            disabled={loading}
          />
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