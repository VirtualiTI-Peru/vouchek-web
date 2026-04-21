'use client';

import { Breadcrumbs, Anchor } from '@mantine/core';
import { usePathname } from 'next/navigation';
import { navigationItems } from '../../config/navigation';

export function AppBreadcrumbs() {
  const pathname = usePathname();

  const getBreadcrumbs = () => {
    const currentItem = navigationItems.find(item =>
      item.href === pathname || (item.href !== '/' && pathname.startsWith(item.href))
    );

    if (!currentItem) return [];

    return [
      { title: 'Home', href: '/' },
      { title: currentItem.label, href: currentItem.href }
    ];
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length <= 1) return null;

  return (
    <Breadcrumbs>
      {breadcrumbs.map((item, index) => (
        <Anchor key={index} href={item.href} size="sm">
          {item.title}
        </Anchor>
      ))}
    </Breadcrumbs>
  );
}