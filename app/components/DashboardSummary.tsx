'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatePickerInput } from '@mantine/dates';
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconEye, IconSortAscending, IconSortDescending } from '@tabler/icons-react';
import type { ReceiptsSummaryByDate } from '@/lib/api-types';
import { fetchReceiptsSummaryByDate as fetchReceiptsSummaryByDateClient } from '@/lib/webapi-client';

type Props = {
  customerId?: string;
  data: ReceiptsSummaryByDate | null;
  date: string;
  initialTimezoneOffsetMinutes?: number;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);

export default function DashboardSummary({ customerId, data, date, initialTimezoneOffsetMinutes }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(date);
  const [summaryData, setSummaryData] = useState<ReceiptsSummaryByDate | null>(data);
  const [sortBy, setSortBy] = useState<'fullName' | 'transactionSource' | 'totalAmount'>('totalAmount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const summaryCacheRef = useRef<Record<string, ReceiptsSummaryByDate | null>>({});

  function formatDateLocal(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getTimezoneOffsetMinutes(value: string): number {
    return new Date(`${value}T00:00:00`).getTimezoneOffset();
  }

  function buildSummaryCacheKey(nextDate: string, timezoneOffsetMinutes: number): string {
    return `${nextDate}:${timezoneOffsetMinutes}`;
  }

  function updateDashboardUrl(nextDate: string, timezoneOffsetMinutes: number, mode: 'push' | 'replace') {
    const nextUrl = `/dashboard?date=${encodeURIComponent(nextDate)}&timezoneOffsetMinutes=${timezoneOffsetMinutes}`;
    if (mode === 'replace') {
      window.history.replaceState(null, '', nextUrl);
      return;
    }

    window.history.pushState(null, '', nextUrl);
  }

  async function loadSummary(nextDate: string, timezoneOffsetMinutes: number, mode: 'push' | 'replace') {
    updateDashboardUrl(nextDate, timezoneOffsetMinutes, mode);
    setSelectedDate(nextDate);

    const cacheKey = buildSummaryCacheKey(nextDate, timezoneOffsetMinutes);
    const cachedSummary = summaryCacheRef.current[cacheKey];
    if (cachedSummary) {
      setSummaryData(cachedSummary);
      return;
    }

    if (!customerId) {
      setSummaryData(null);
      return;
    }

    try {
      const nextSummary = await fetchReceiptsSummaryByDateClient(customerId, nextDate, {
        timezoneOffsetMinutes,
      });
      summaryCacheRef.current[cacheKey] = nextSummary;
      setSummaryData(nextSummary);
    } catch {
      setSummaryData(null);
    }
  }

  useEffect(() => {
    const effectiveTimezoneOffsetMinutes = typeof initialTimezoneOffsetMinutes === 'number'
      ? initialTimezoneOffsetMinutes
      : getTimezoneOffsetMinutes(date);

    summaryCacheRef.current[buildSummaryCacheKey(date, effectiveTimezoneOffsetMinutes)] = data;
    setSelectedDate(date);
    setSummaryData(data);

    if (typeof initialTimezoneOffsetMinutes !== 'number') {
      void loadSummary(date, effectiveTimezoneOffsetMinutes, 'replace');
    }
  }, [customerId, data, date, initialTimezoneOffsetMinutes]);

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
    params.set('date', selectedDate);
    params.set('timezoneOffsetMinutes', String(getTimezoneOffsetMinutes(selectedDate)));
    params.set('transactionSource', options.transactionSource);
    if (options.userId) {
      params.set('userId', options.userId);
    }
    if (options.userName) {
      params.set('userName', options.userName);
    }
    router.push(`/receipts?${params.toString()}`);
  }

  function handleDateChange(value: Date | null) {
    if (!value) return;
    const iso = formatDateLocal(value);
    void loadSummary(iso, getTimezoneOffsetMinutes(iso), 'push');
  }

  const parsedDate = new Date(`${selectedDate}T00:00:00`);
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

  return (
    <Stack gap="xl">
      <DatePickerInput
        label="Fecha"
        value={parsedDate}
        onChange={handleDateChange}
        maw={200}
      />

      <div>
        <Title order={4} mb="sm">Resumen por origen</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          {summaryData?.summaryBySource.map((item) => (
            <Card
              key={item.transactionSource}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => openReceiptsView({ transactionSource: item.transactionSource })}
            >
              <Text fw={600} size="sm" c="dimmed" tt="uppercase">
                {item.transactionSource}
              </Text>
              <Text fw={700} size="xl" mt="xs">
                {formatCurrency(item.totalAmount)}
              </Text>
            </Card>
          ))}
          {!summaryData?.summaryBySource.length && (
            <Text c="dimmed">Sin datos para la fecha seleccionada.</Text>
          )}
        </SimpleGrid>
      </div>

      <div>
        <Title order={4} mb="sm">Totales por usuario</Title>
        <TextInput
          mb="md"
          label="Buscar"
          placeholder="Usuario, origen o total"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />

        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={600}>Usuario</Text>
                  <ActionIcon variant="subtle" size="sm" onClick={() => handleSort('fullName')}>
                    {sortBy === 'fullName' && sortDir === 'desc' ? <IconSortDescending size={16} /> : <IconSortAscending size={16} />}
                  </ActionIcon>
                </Group>
              </Table.Th>
              <Table.Th>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={600}>Origen</Text>
                  <ActionIcon variant="subtle" size="sm" onClick={() => handleSort('transactionSource')}>
                    {sortBy === 'transactionSource' && sortDir === 'desc' ? <IconSortDescending size={16} /> : <IconSortAscending size={16} />}
                  </ActionIcon>
                </Group>
              </Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>
                <Group gap={6} justify="flex-end" wrap="nowrap">
                  <Text size="sm" fw={600}>Total</Text>
                  <ActionIcon variant="subtle" size="sm" onClick={() => handleSort('totalAmount')}>
                    {sortBy === 'totalAmount' && sortDir === 'desc' ? <IconSortDescending size={16} /> : <IconSortAscending size={16} />}
                  </ActionIcon>
                </Group>
              </Table.Th>
              <Table.Th style={{ width: 56 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredAndSortedRows.map((row) => (
              <Table.Tr key={`${row.userId}-${row.transactionSource}`}>
                <Table.Td>{row.fullName}</Table.Td>
                <Table.Td>
                  <Badge variant="light">{row.transactionSource}</Badge>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  {formatCurrency(row.totalAmount)}
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => openReceiptsView({
                      transactionSource: row.transactionSource,
                      userId: row.userId,
                      userName: row.fullName,
                    })}
                    aria-label="Ver vouchers"
                    title="Ver vouchers"
                  >
                    <IconEye size={18} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
            {!filteredAndSortedRows.length && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center">Sin resultados con los filtros actuales.</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </div>
    </Stack>
  );
}
