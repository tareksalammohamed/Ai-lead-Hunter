// ============================================================
// RBAC Engine — Role-Based Access Control
// Server-side authorization logic (enforced in service layer)
// ============================================================

import type { Permission, SystemRole, RoleDefinition, AdminUser } from '@/types';
import { dbGetAll, dbPut, generateId, nowISO } from './db';

// ---- Default Role Definitions ----
export const ALL_PERMISSIONS: Permission[] = [
  'view_dashboard', 'create_campaign', 'run_agent', 'view_leads',
  'edit_leads', 'delete_leads', 'export_leads', 'manage_sources',
  'manage_ai', 'manage_users', 'manage_settings', 'view_analytics',
  'view_audit_logs', 'manage_billing', 'access_super_admin',
];

export const DEFAULT_ROLES: Omit<RoleDefinition, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'SUPER_ADMIN',
    description: 'أعلى مستوى صلاحيات — تحكم كامل في النظام',
    permissions: [...ALL_PERMISSIONS],
    is_system: true,
  },
  {
    name: 'ADMIN',
    description: 'مدير النظام — إدارة المستخدمين والإعدادات',
    permissions: ['view_dashboard', 'create_campaign', 'run_agent', 'view_leads', 'edit_leads', 'delete_leads', 'export_leads', 'manage_sources', 'manage_ai', 'manage_users', 'manage_settings', 'view_analytics', 'view_audit_logs'],
    is_system: true,
  },
  {
    name: 'MANAGER',
    description: 'مدير — إدارة الحملات والعملاء',
    permissions: ['view_dashboard', 'create_campaign', 'run_agent', 'view_leads', 'edit_leads', 'export_leads', 'view_analytics'],
    is_system: true,
  },
  {
    name: 'RESEARCHER',
    description: 'باحث — تشغيل البحث وعرض العملاء',
    permissions: ['view_dashboard', 'create_campaign', 'run_agent', 'view_leads', 'export_leads'],
    is_system: true,
  },
  {
    name: 'USER',
    description: 'مستخدم عادي — عرض لوحة التحكم والعملاء',
    permissions: ['view_dashboard', 'view_leads'],
    is_system: true,
  },
];

// ---- Initialize default roles ----
export async function initRoles(): Promise<void> {
  const existing = await dbGetAll<RoleDefinition>('admin_roles');
  if (existing.length > 0) return;
  for (const role of DEFAULT_ROLES) {
    const r: RoleDefinition = {
      ...role,
      id: generateId(),
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    await dbPut('admin_roles', r);
  }
}

// ---- Get all roles ----
export async function getRoles(): Promise<RoleDefinition[]> {
  await initRoles();
  return dbGetAll<RoleDefinition>('admin_roles');
}

// ---- Get role by name ----
export async function getRoleByName(name: string): Promise<RoleDefinition | null> {
  const roles = await getRoles();
  return roles.find((r) => r.name === name) ?? null;
}

// ---- Create custom role ----
export async function createRole(name: string, description: string, permissions: Permission[]): Promise<RoleDefinition> {
  const role: RoleDefinition = {
    id: generateId(),
    name,
    description,
    permissions,
    is_system: false,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await dbPut('admin_roles', role);
  return role;
}

// ---- Update role ----
export async function updateRole(id: string, updates: Partial<RoleDefinition>): Promise<void> {
  const roles = await dbGetAll<RoleDefinition>('admin_roles');
  const existing = roles.find((r) => r.id === id);
  if (!existing || existing.is_system) return;
  await dbPut('admin_roles', { ...existing, ...updates, updated_at: nowISO() });
}

// ---- Delete role (non-system only) ----
export async function deleteRole(id: string): Promise<void> {
  const roles = await dbGetAll<RoleDefinition>('admin_roles');
  const existing = roles.find((r) => r.id === id);
  if (!existing || existing.is_system) return;
  const { dbDelete } = await import('./db');
  await dbDelete('admin_roles', id);
}

// ---- Check if user has permission ----
export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  const users = await dbGetAll<AdminUser>('admin_users');
  const user = users.find((u) => u.id === userId);
  if (!user) return false;
  if (user.status !== 'active') return false;
  if (user.role === 'SUPER_ADMIN') return true;
  const role = await getRoleByName(user.role);
  if (!role) return false;
  return role.permissions.includes(permission);
}

// ---- Check if user is super admin ----
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const users = await dbGetAll<AdminUser>('admin_users');
  const user = users.find((u) => u.id === userId);
  return user?.role === 'SUPER_ADMIN' && user?.status === 'active';
}

// ---- Get user permissions ----
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const users = await dbGetAll<AdminUser>('admin_users');
  const user = users.find((u) => u.id === userId);
  if (!user || user.status !== 'active') return [];
  if (user.role === 'SUPER_ADMIN') return [...ALL_PERMISSIONS];
  const role = await getRoleByName(user.role);
  return role?.permissions ?? [];
}
