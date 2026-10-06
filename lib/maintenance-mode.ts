export type MaintenanceScope = 'global' | 'organization' | 'event'

export interface MaintenanceWindow {
  scope: MaintenanceScope
  scopeId?: string | null
  startsAt: number
  endsAt?: number | null
  readOnly: boolean
  message?: string | null
}

export function maintenanceIsActive(window: MaintenanceWindow, now = Date.now()): boolean {
  return window.startsAt <= now && (window.endsAt == null || window.endsAt > now)
}

export function maintenanceBlocksWrites(window: MaintenanceWindow, now = Date.now()): boolean {
  return maintenanceIsActive(window, now) && window.readOnly
}

export function maintenanceWindowIsValid(window: MaintenanceWindow): boolean {
  return window.endsAt == null || window.endsAt > window.startsAt
}
