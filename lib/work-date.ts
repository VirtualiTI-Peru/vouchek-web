export const WORK_DATE_ROUTES = ['/dashboard', '/receipts'] as const;

const WORK_DATE_STORAGE_KEY = 'vouchek.workDate';
const WORK_DATE_TZ_STORAGE_KEY = 'vouchek.workDateTimezoneOffsetMinutes';

export type StoredWorkDate = {
  date: string;
  timezoneOffsetMinutes: number;
};

export function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateLocal(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeWorkDate(date?: string | null): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return getTodayLocalDateString();
}

export function getTimezoneOffsetMinutes(date: string): number {
  return new Date(`${date}T00:00:00`).getTimezoneOffset();
}

export function isWorkDateRoute(pathname: string): boolean {
  return WORK_DATE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function buildWorkDateQuery(date: string, timezoneOffsetMinutes?: number): string {
  const params = new URLSearchParams();
  params.set('date', date);
  params.set(
    'timezoneOffsetMinutes',
    String(typeof timezoneOffsetMinutes === 'number' ? timezoneOffsetMinutes : getTimezoneOffsetMinutes(date)),
  );
  return params.toString();
}

export function getStoredWorkDate(): StoredWorkDate | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const date = sessionStorage.getItem(WORK_DATE_STORAGE_KEY);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return null;
    }

    const timezoneOffsetMinutesRaw = sessionStorage.getItem(WORK_DATE_TZ_STORAGE_KEY);
    const timezoneOffsetMinutes = timezoneOffsetMinutesRaw
      ? Number(timezoneOffsetMinutesRaw)
      : getTimezoneOffsetMinutes(date);

    if (!Number.isFinite(timezoneOffsetMinutes)) {
      return { date, timezoneOffsetMinutes: getTimezoneOffsetMinutes(date) };
    }

    return { date, timezoneOffsetMinutes };
  } catch {
    return null;
  }
}

export function setStoredWorkDate(date: string, timezoneOffsetMinutes: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(WORK_DATE_STORAGE_KEY, date);
    sessionStorage.setItem(WORK_DATE_TZ_STORAGE_KEY, String(timezoneOffsetMinutes));
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
}

export function resolveWorkDate(searchParams: URLSearchParams): StoredWorkDate {
  const urlDate = searchParams.get('date');
  if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
    const timezoneOffsetMinutesRaw = searchParams.get('timezoneOffsetMinutes');
    const timezoneOffsetMinutes = timezoneOffsetMinutesRaw && Number.isFinite(Number(timezoneOffsetMinutesRaw))
      ? Number(timezoneOffsetMinutesRaw)
      : getTimezoneOffsetMinutes(urlDate);

    return { date: urlDate, timezoneOffsetMinutes };
  }

  const stored = getStoredWorkDate();
  if (stored) {
    return stored;
  }

  const today = getTodayLocalDateString();
  return { date: today, timezoneOffsetMinutes: getTimezoneOffsetMinutes(today) };
}

import { getStoredWorkCustomerId, WORK_CUSTOMER_ID_PARAM } from '@/lib/work-org';

export function appendWorkDateToHref(href: string, searchParams: URLSearchParams): string {
  if (href !== '/dashboard' && href !== '/receipts') {
    return href;
  }

  const { date, timezoneOffsetMinutes } = resolveWorkDate(searchParams);
  const params = new URLSearchParams(buildWorkDateQuery(date, timezoneOffsetMinutes));

  const customerId = searchParams.get(WORK_CUSTOMER_ID_PARAM) ?? getStoredWorkCustomerId();
  if (customerId) {
    params.set(WORK_CUSTOMER_ID_PARAM, customerId);
  }

  return `${href}?${params.toString()}`;
}
