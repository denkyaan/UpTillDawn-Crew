export type Permission = 'view-own-shifts' | 'view-event-staff' | 'manage-shifts' | 'manage-workplaces' | 'assign-tasks' | 'manage-briefing' | 'resolve-incidents' | 'correct-hours' | 'export-data' | 'manage-roles' | 'manage-automations'
export type PermissionRole = 'employee' | 'responsible' | 'admin'

const ROLE_PERMISSIONS: Record<PermissionRole, readonly Permission[]> = {
  employee: ['view-own-shifts'],
  responsible: ['view-own-shifts','view-event-staff','manage-workplaces','assign-tasks','resolve-incidents'],
  admin: ['view-own-shifts','view-event-staff','manage-shifts','manage-workplaces','assign-tasks','manage-briefing','resolve-incidents','correct-hours','export-data','manage-roles','manage-automations'],
}

export function roleHasPermission(role: PermissionRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function permissionsForRole(role: PermissionRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}
