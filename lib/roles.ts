export type UserRole = 'superadmin' | 'employee'

export const USER_ROLES: Record<string, UserRole> = {
  microsmart:  'superadmin',
  microwhardy: 'superadmin',
  microsaddi:  'employee',
  microsharon: 'employee',
}

export interface Permissions {
  canViewComparador:   boolean
  canViewGremio:       boolean
  canViewCF:           boolean
  canViewProveedores:  boolean
  canViewNotas:        boolean
  canUploadSuppliers:  boolean
  canManageNotas:      boolean
  canViewOrdenes:      boolean
  canViewServicios:    boolean
  canViewClientes:     boolean
  canViewAgenda:       boolean
  canViewStock:        boolean
  canViewVentas:       boolean
  canViewGastos:       boolean
  canViewComisiones:   boolean
  canViewReportes:     boolean
  canViewIMEI:         boolean
  canViewHerramientas: boolean
  canViewVentasEquipos: boolean
  canViewContable:     boolean
}

export const PERM_LABELS: Record<keyof Permissions, string> = {
  canViewComparador:    'Ver Listas de precio',
  canViewGremio:        'Ver Gremio',
  canViewCF:            'Ver Consumidor Final',
  canViewProveedores:   'Ver Proveedores',
  canViewNotas:         'Ver Notas',
  canUploadSuppliers:   'Cargar proveedores',
  canManageNotas:       'Resolver / eliminar notas',
  canViewOrdenes:       'Órdenes de trabajo',
  canViewServicios:     'Servicios',
  canViewClientes:      'Clientes',
  canViewAgenda:        'Turnos / Agenda',
  canViewStock:         'Stock',
  canViewVentas:        'Ventas',
  canViewGastos:        'Gastos',
  canViewComisiones:    'Comisiones',
  canViewReportes:      'Reportes',
  canViewIMEI:          'Verificar IMEI',
  canViewHerramientas:  'Herramientas Técnicas',
  canViewVentasEquipos: 'Venta de equipos',
  canViewContable:      'Administración contable',
}

export const SUPERADMIN_PERMISSIONS: Permissions = {
  canViewComparador:    true,
  canViewGremio:        true,
  canViewCF:            true,
  canViewProveedores:   true,
  canViewNotas:         true,
  canUploadSuppliers:   true,
  canManageNotas:       true,
  canViewOrdenes:       true,
  canViewServicios:     true,
  canViewClientes:      true,
  canViewAgenda:        true,
  canViewStock:         true,
  canViewVentas:        true,
  canViewGastos:        true,
  canViewComisiones:    true,
  canViewReportes:      true,
  canViewIMEI:          true,
  canViewHerramientas:  true,
  canViewVentasEquipos: true,
  canViewContable:      true,
}

export const DEFAULT_EMPLOYEE_PERMISSIONS: Permissions = {
  canViewComparador:    true,
  canViewGremio:        true,
  canViewCF:            true,
  canViewProveedores:   false,
  canViewNotas:         true,
  canUploadSuppliers:   false,
  canManageNotas:       false,
  canViewOrdenes:       true,
  canViewServicios:     true,
  canViewClientes:      true,
  canViewAgenda:        true,
  canViewStock:         true,
  canViewVentas:        true,
  canViewGastos:        true,
  canViewComisiones:    true,
  canViewReportes:      true,
  canViewIMEI:          true,
  canViewHerramientas:  true,
  canViewVentasEquipos: true,
  canViewContable:      false,  // empleados no ven contabilidad por defecto
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
