'use client';

import { type ReactNode } from 'react';
import { hasPermission, type Permission } from '@/config/roles';
import { useRole } from '@/lib/hooks/use-role';

interface RoleGateProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ permission, children, fallback = null }: RoleGateProps) {
  const { role, loading } = useRole();
  if (loading) return null;
  if (!hasPermission(role, permission)) return <>{fallback}</>;
  return <>{children}</>;
}
