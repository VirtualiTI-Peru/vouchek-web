import {
  LayoutDashboard,
  Receipt,
  Users,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  /** 'superadmin' = superadmin only; 'admin' = superadmin, org:admin or org:sistema; 'reports' = org report pages */
  permission?: 'superadmin' | 'admin' | 'reports';
}

export const navigationItems: NavItem[] = [
  {
    label: 'Resumen',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Resumen general y métricas.',
    permission: 'reports',
  },
  {
    label: 'Vouchers',
    href: '/receipts',
    icon: Receipt,
    description: 'Registro de vouchers.',
    permission: 'reports',
  },
  {
    label: 'Usuarios',
    href: '/users',
    icon: Users,
    description: 'Gestión de usuarios.',
    permission: 'admin',
  },
  {
    label: 'Clientes',
    href: '/configuration',
    icon: Settings,
    description: 'Gestión de clientes.',
    permission: 'superadmin',
  },
];
