export type UserRole = 'superadmin' | 'employee'

export const USER_ROLES: Record<string, UserRole> = {
  microsmart:  'superadmin',
  microwhardy: 'superadmin',
  microsaddi:  'employee',
  microsharon: 'employee',
}

export interface Permissions {
  canViewComparador: boolean
  canViewGremio:     boolean
  canViewCF:         boolean
  canViewProveedores: boolean
  canViewNotas:      boolean
  canUploadSuppliers: boolean
  canManageNotas:    boolean
}

export const PERM_LABELS: Record<keyof Permissions, string> = {
  canViewComparador:  'Ver Listas de precio',
  canViewGremio:      'Ver Gremio',
  canViewCF:          'Ver Consumidor Final',
  canViewProveedores: 'Ver Proveedores',
  canViewNotas:       'Ver Notas',
  canUploadSuppliers: 'Cargar proveedores',
  canManageNotas:     'Resolver / eliminar notas',
}

export const SUPERADMIN_PERMISSIONS: Permissions = {
  canViewComparador:  true,
  canViewGremio:      true,
  canViewCF:          true,
  canViewProveedores: true,
  canViewNotas:       true,
  canUploadSuppliers: true,
  canManageNotas:     true,
}

export const DEFAULT_EMPLOYEE_PERMISSIONS: Permissions = {
  canViewComparador:  true,
  canViewGremio:      true,
  canViewCF:          true,
  canViewProveedores: false,
  canViewNotas:       true,
  canUploadSuppliers: false,
  canManageNotas:     false,
}

export function getRole(username: string): UserRole {
  return USER_ROLES[username] ?? 'employee'
}

export function isSuperAdmin(username: string): boolean {
  return getRole(username) === 'superadmin'
}

export const EMPLOYEE_USERNAMES = Object.entries(USER_ROLES)
  .filter(([, role]) => role === 'employee')
  .map(([u]) => u)
