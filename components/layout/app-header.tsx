'use client';

import { Suspense } from 'react';
import { Menu } from 'lucide-react';
import { useConfig } from '@/hooks/use-config';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from './theme-switcher';
import { UserMenu } from './user-menu';
import { QuotaButton } from './quota-button';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NavLinks } from './app-sidebar';
import { WorkDateFilter } from './work-date-filter';
import { WorkOrgFilter } from './work-org-filter';
import type { PortalOrganization } from '@/lib/work-org';
import { VouchekLogo } from '@/components/vouchek-logo';

type AppHeaderProps = {
  user?: {
    email?: string;
    user_metadata?: { full_name?: string };
  } | null;
  displayName?: string;
  canSeeReports?: boolean;
  canSeeAdmin?: boolean;
  canSeeSuper?: boolean;
  canSeeUsage?: boolean;
  orgId?: string;
  organizations?: PortalOrganization[];
  onProfileClick?: () => void;
};

export function AppHeader({
  user,
  displayName,
  canSeeReports,
  canSeeAdmin,
  canSeeSuper,
  canSeeUsage,
  orgId,
  organizations = [],
  onProfileClick,
}: AppHeaderProps) {
  const [config, setConfig] = useConfig();

  return (
    <header className="sticky top-0 z-40">
      <div
        className={cn(
          'flex items-center justify-between bg-header backdrop-blur-lg border-b border-default-200 shadow-base md:px-6 px-4 py-3',
          config.collapsed ? 'xl:ms-[72px]' : 'xl:ms-[248px]',
        )}
      >
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild className="xl:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[248px]">
              <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
              <div className="p-4 border-b">
                <VouchekLogo width={132} />
              </div>
              <div className="p-3">
                <NavLinks canSeeReports={canSeeReports} canSeeAdmin={canSeeAdmin} canSeeSuper={canSeeSuper} />
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="hidden xl:inline-flex"
            onClick={() => setConfig({ ...config, collapsed: !config.collapsed })}
            aria-label="Contraer menú"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <VouchekLogo width={112} className="xl:hidden" />
          <Suspense fallback={null}>
            <WorkOrgFilter
              isSuperAdmin={canSeeSuper}
              organizations={organizations}
              ownOrgId={orgId}
            />
          </Suspense>
          <Suspense fallback={null}>
            <WorkDateFilter />
          </Suspense>
        </div>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {canSeeUsage ? (
            <QuotaButton
              ownOrgId={orgId}
              isSuperAdmin={canSeeSuper}
              organizations={organizations}
            />
          ) : null}
          <UserMenu user={user} displayName={displayName} onProfileClick={onProfileClick} />
        </div>
      </div>
    </header>
  );
}
