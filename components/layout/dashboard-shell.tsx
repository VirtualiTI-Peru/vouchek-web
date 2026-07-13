'use client';

import { Suspense, useState } from 'react';
import LayoutProvider from '@/providers/layout.provider';
import LayoutContentProvider from '@/providers/content.provider';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { ProfileDialog } from './profile-dialog';
import { TermsAcceptanceModal } from './terms-acceptance-modal';
import type { PortalOrganization } from '@/lib/work-org';
import type { TermsDocument } from '@/lib/legal';

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
  termsDocument?: TermsDocument | null;
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
  termsDocument = null,
  children,
}: DashboardShellProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(!termsDocument);

  const blockedByTerms = Boolean(termsDocument) && !termsAccepted;

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
      <LayoutContentProvider>
        <div className={blockedByTerms ? 'pointer-events-none select-none opacity-40' : undefined} aria-hidden={blockedByTerms}>
          {children}
        </div>
      </LayoutContentProvider>
      <ProfileDialog open={profileOpen && !blockedByTerms} onClose={() => setProfileOpen(false)} />
      {blockedByTerms && termsDocument ? (
        <TermsAcceptanceModal
          document={termsDocument}
          onAccepted={() => setTermsAccepted(true)}
        />
      ) : null}
    </LayoutProvider>
  );
}
