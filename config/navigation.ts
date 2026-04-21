import {
  IconReceipt,
  IconUsers,
  IconSettings,
  IconDashboard,
} from '@tabler/icons-react';

export interface NavItem {
  label: string;
  href: string;
  icon: any;
  description?: string;
}

export const navigationItems: NavItem[] = [
  {
    label: 'Receipts',
    href: '/receipts',
    icon: IconReceipt,
    description: 'Manage receipts',
  },
  {
    label: 'Users',
    href: '/users',
    icon: IconUsers,
    description: 'User management',
  },
  {
    label: 'Configuration',
    href: '/configuration',
    icon: IconSettings,
    description: 'System settings',
  },
];