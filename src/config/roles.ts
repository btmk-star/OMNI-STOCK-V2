export const ROLES = {
  admin: 'admin',
  manager: 'manager',
  spv: 'spv',
  senior_staff: 'senior_staff',
  viewer: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  spv: 'SPV',
  senior_staff: 'Senior Staff',
  viewer: 'Viewer',
};

// Permission matrix — sesuai PRD §8 RBAC.
// Update bersama dengan PRD jika ada perubahan akses.
export const PERMISSIONS = {
  'dashboard.view_nominal': ['admin', 'manager'],
  'dashboard.view_pattern': ['admin', 'manager', 'spv', 'senior_staff', 'viewer'],

  'products.view': ['admin', 'manager', 'spv', 'senior_staff', 'viewer'],

  'inventory.full': ['admin', 'manager', 'spv', 'senior_staff'],
  'inventory.view': ['admin', 'manager', 'spv', 'senior_staff', 'viewer'],
  'recipes.edit': ['admin', 'manager'],

  'suppliers.manage': ['admin', 'manager'],
  'po.create': ['admin', 'manager', 'spv', 'senior_staff'],
  'po.approve': ['admin', 'manager'],
  'po.send_wa': ['admin', 'manager', 'spv', 'senior_staff'],
  'delivery.receive': ['admin', 'manager', 'spv', 'senior_staff'],
  'billing.view': ['admin', 'manager'],
  'billing.read_only': ['admin', 'manager', 'spv'],

  'reports.full': ['admin', 'manager', 'spv'],
  'reports.view': ['admin', 'manager', 'spv', 'senior_staff', 'viewer'],
  'po_logs.view': ['admin', 'manager', 'spv', 'senior_staff'],

  'ai.predictions': ['admin', 'manager', 'spv'],

  'users.manage': ['admin'],
  'settings.manage': ['admin'],

  'stores.view': ['admin', 'manager', 'spv', 'senior_staff', 'viewer'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
