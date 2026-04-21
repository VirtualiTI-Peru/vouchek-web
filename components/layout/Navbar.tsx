'use client';

import { AppShell, NavLink, Stack } from '@mantine/core';
import { usePathname, useRouter } from 'next/navigation';
import { navigationItems } from '../../config/navigation';

export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <AppShell.Navbar p="md">
      <AppShell.Section>
        <Stack gap="xs">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href === '/' && pathname === '/') ||
              (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <NavLink
                key={item.href}
                label={item.label}
                description={item.description}
                leftSection={<item.icon size={16} />}
                active={isActive}
                onClick={() => router.push(item.href)}
                variant={isActive ? 'filled' : 'light'}
              />
            );
          })}
        </Stack>
      </AppShell.Section>
    </AppShell.Navbar>
  );
}