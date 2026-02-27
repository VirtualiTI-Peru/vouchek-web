'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { appendWorkDateToHref } from '@/lib/work-date';
import { navigationItems, type NavItem } from '@/config/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useConfig } from '@/hooks/use-config';
import { useMenuHoverConfig } from '@/hooks/use-menu-hover';

type NavLinksProps = {
  canSeeReports?: boolean;
  canSeeAdmin?: boolean;
  canSeeSuper?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
};

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ canSeeReports = false, canSeeAdmin = false, canSeeSuper = false, collapsed = false, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const visibleItems = navigationItems.filter((item) => {
    if (item.permission === 'superadmin') return canSeeSuper;
    if (item.permission === 'admin') return canSeeAdmin;
    if (item.permission === 'reports') return canSeeReports;
    return true;
  });

  return (
    <nav className="space-y-1">
      {visibleItems.map((item: NavItem) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Button
            key={item.href}
            variant={active ? 'default' : 'ghost'}
            color={active ? 'primary' : 'default'}
            className={cn(
              'w-full justify-start capitalize font-medium h-auto py-2.5 hover:ring-0 hover:ring-offset-0',
              collapsed && 'justify-center px-0',
              !active && [
                'text-default-600 dark:text-default-700',
                'hover:bg-default-100 hover:text-default-900',
                'dark:hover:bg-default-400 dark:hover:text-default-950',
              ],
            )}
            size={collapsed ? 'icon' : 'default'}
            asChild
          >
            <Link href={appendWorkDateToHref(item.href, searchParams)} title={collapsed ? item.label : undefined} onClick={onNavigate}>
              <Icon className={cn('h-4 w-4', !collapsed && 'me-2')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

type AppSidebarProps = {
  canSeeReports?: boolean;
  canSeeAdmin?: boolean;
  canSeeSuper?: boolean;
};

export function AppSidebar({ canSeeReports = false, canSeeAdmin = false, canSeeSuper = false }: AppSidebarProps) {
  const [config] = useConfig();
  const [hoverConfig] = useMenuHoverConfig();
  const collapsed = config.collapsed && !hoverConfig.hovered;
  const searchParams = useSearchParams();

  return (
    <aside
      className={cn(
        'fixed z-50 top-0 start-0 h-full bg-sidebar shadow-base xl:block hidden border-e border-default-200',
        collapsed ? 'w-[72px]' : 'w-[248px]',
      )}
    >
      <div className="flex flex-col h-full py-4">
        <div className={cn('px-4 mb-6', collapsed && 'px-2')}>
          <Link href={appendWorkDateToHref('/dashboard', searchParams)} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              V
            </div>
            {!collapsed && (
              <span className="text-lg font-semibold text-default-900">VouChek</span>
            )}
          </Link>
        </div>
        <ScrollArea className="flex-1 px-3">
          <NavLinks canSeeReports={canSeeReports} canSeeAdmin={canSeeAdmin} canSeeSuper={canSeeSuper} collapsed={collapsed} />
        </ScrollArea>
      </div>
    </aside>
  );
}
