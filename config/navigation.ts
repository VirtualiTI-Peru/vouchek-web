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
    label: 'Resumen',
    href: '/dashboard',
    icon: IconDashboard,
    description: 'Resumen general y métricas.',
  },
  {
    label: 'Vouchers',
    href: '/receipts',
    icon: IconReceipt,
    description: 'Registro de Vouchers.',
  },
  {
    label: 'Usuarios',
    href: '/users',
    icon: IconUsers,
    description: 'Gestión de usuarios.',
  },
  {
    label: 'Configuración',
    href: '/configuration',
    icon: IconSettings,
    description: 'Configuración del sistema',
  },
];