'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatDateLocal,
  getTimezoneOffsetMinutes,
  isWorkDateRoute,
  resolveWorkDate,
  setStoredWorkDate,
} from '@/lib/work-date';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function WorkDateFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const { date: selectedDate } = useMemo(
    () => resolveWorkDate(searchParams),
    [searchParams],
  );

  const parsedDate = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);

  useEffect(() => {
    if (!isWorkDateRoute(pathname)) {
      return;
    }

    const urlDate = searchParams.get('date');
    const resolved = resolveWorkDate(searchParams);

    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      setStoredWorkDate(resolved.date, resolved.timezoneOffsetMinutes);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('date', resolved.date);
    params.set('timezoneOffsetMinutes', String(resolved.timezoneOffsetMinutes));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  if (!isWorkDateRoute(pathname)) {
    return null;
  }

  function handleDateChange(value: Date | undefined) {
    if (!value) return;

    const nextDate = formatDateLocal(value);
    const timezoneOffsetMinutes = getTimezoneOffsetMinutes(nextDate);
    setStoredWorkDate(nextDate, timezoneOffsetMinutes);

    const params = new URLSearchParams(searchParams.toString());
    params.set('date', nextDate);
    params.set('timezoneOffsetMinutes', String(timezoneOffsetMinutes));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="work-date-filter" className="hidden md:inline text-sm text-default-600 whitespace-nowrap">
        Fecha de operación
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="work-date-filter"
            variant="outline"
            size="sm"
            className={cn('justify-start text-left font-normal min-w-[160px]')}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {format(parsedDate, 'PPP', { locale: es })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsedDate}
            onSelect={handleDateChange}
            initialFocus
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
