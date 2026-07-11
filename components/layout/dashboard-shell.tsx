'use client';

import { Suspense, useState } from 'react';
import LayoutProvider from '@/providers/layout.provider';
import LayoutContentProvider from '@/providers/content.provider';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { ProfileDialog } from './profile-dialog';
import type { PortalOrganization } from '@/lib/work-org';

type DashboardShellProps = {
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
  children: React.ReactNode;
};

export function DashboardShell({
  user,
  displayName,
  canSeeReports,
  canSeeAdmin,
  canSeeSuper,
  canSeeUsage,
  orgId,
  organizations = [],
  children,
}: DashboardShellProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <LayoutProvider>
      <Suspense fallback={null}>
        <AppSidebar canSeeReports={canSeeReports} canSeeAdmin={canSeeAdmin} canSeeSuper={canSeeSuper} />
      </Suspense>
      <AppHeader
        user={user}
        displayName={displayName}
        canSeeReports={canSeeReports}
        canSeeAdmin={canSeeAdmin}
        canSeeSuper={canSeeSuper}
        canSeeUsage={canSeeUsage}
        orgId={orgId}
        organizations={organizations}
        onProfileClick={() => setProfileOpen(true)}
      />
      <LayoutContentProvider>{children}</LayoutContentProvider>
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </LayoutProvider>
  );
}
