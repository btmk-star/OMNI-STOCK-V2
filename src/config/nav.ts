import {
  LayoutDashboard,
  Store,
  Package,
  ClipboardList,
  Boxes,
  ChefHat,
  Soup,
  BookOpen,
  Utensils,
  Truck,
  ScrollText,
  HandCoins,
  History,
  BarChart3,
  Users,
  Settings,
  Calculator,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/config/roles';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

// Sidebar order must mirror PRD §4.1 — keep in sync.
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Discover',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view_pattern' },
      { href: '/stores', label: 'Stores', icon: Store, permission: 'stores.view' },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/management/hpp', label: 'Kalkulator HPP', icon: Calculator, permission: 'inventory.view' },
      { href: '/management/overview', label: 'Overview', icon: Layers, permission: 'reports.view' },
    ],
  },
  {
    label: 'Products',
    items: [
      { href: '/products', label: 'Products', icon: Package, permission: 'products.view' },
      { href: '/inventory/stock-card', label: 'Kartu Stok', icon: Boxes, permission: 'inventory.view' },
      { href: '/inventory/master-bahan', label: 'Master Bahan', icon: ChefHat, permission: 'inventory.view' },
      { href: '/inventory/raw-menu', label: 'Raw Menu', icon: Soup, permission: 'inventory.view' },
      { href: '/inventory/master-resep', label: 'Master Resep', icon: BookOpen, permission: 'inventory.view' },
      { href: '/inventory/master-menu', label: 'Master Menu', icon: Utensils, permission: 'inventory.view' },
    ],
  },
  {
    label: 'Procurement',
    items: [
      { href: '/procurement/suppliers', label: 'Suppliers', icon: ClipboardList, permission: 'suppliers.manage' },
      { href: '/procurement/purchase-orders', label: 'Purchase Orders', icon: ScrollText, permission: 'po.create' },
      { href: '/procurement/delivery', label: 'Delivery', icon: Truck, permission: 'delivery.receive' },
      { href: '/procurement/billing', label: 'Billing', icon: HandCoins, permission: 'billing.read_only' },
      { href: '/procurement/po-logs', label: 'PO Logs', icon: History, permission: 'po_logs.view' },
    ],
  },
  {
    label: 'Analytics',
    items: [{ href: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports.view' }],
  },
  {
    label: 'Settings',
    items: [
      { href: '/users', label: 'Users', icon: Users, permission: 'users.manage' },
      { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
    ],
  },
];

export const MOBILE_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: LayoutDashboard, permission: 'dashboard.view_pattern' },
  { href: '/products', label: 'Products', icon: Package, permission: 'products.view' },
  { href: '/procurement/purchase-orders', label: 'PO', icon: ScrollText, permission: 'po.create' },
  { href: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports.view' },
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
];
