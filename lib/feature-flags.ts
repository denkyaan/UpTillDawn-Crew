export const FEATURE_FLAGS = {
  shiftHome: true,
  operationsBoard: true,
  offlineQueue: true,
  pushNotifications: true,
  globalSearch: false,
  commandPalette: false,
  planningCalendar: false,
  liveOccupancy: false,
  automationEngine: false,
  eventLifecycle: false,
  eventTemplates: false,
  postEventReports: false,
  inventory: false,
  transport: false,
  documentCenter: false,
  kioskMode: false,
  multiTenant: false,
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}
