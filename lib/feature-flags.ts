export const FEATURE_FLAGS = {
  shiftHome: true,
  operationsBoard: true,
  offlineQueue: true,
  pushNotifications: true,
  globalSearch: false,
  commandPalette: false,
  planningCalendar: true,
  liveOccupancy: true,
  automationEngine: true,
  eventLifecycle: true,
  eventTemplates: true,
  postEventReports: true,
  inventory: true,
  transport: false,
  documentCenter: false,
  kioskMode: false,
  multiTenant: false,
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS
export type FeatureFlagAudience = 'all' | 'admin' | 'responsible' | 'employee'

export interface FeatureFlagRollout {
  key: FeatureFlag
  enabled: boolean
  organizationId?: string | null
  audience: FeatureFlagAudience
  rolloutPercentage: number
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}

function stableBucket(subjectId: string, key: string): number {
  let hash = 0
  for (const char of `${subjectId}:${key}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 100
}

export function rolloutEnabled(config: FeatureFlagRollout, subjectId: string, role: Exclude<FeatureFlagAudience, 'all'>, organizationId?: string | null): boolean {
  if (!config.enabled || !isFeatureEnabled(config.key)) return false
  if (config.organizationId && config.organizationId !== organizationId) return false
  if (config.audience !== 'all' && config.audience !== role) return false
  const rollout = Math.max(0, Math.min(100, config.rolloutPercentage))
  return stableBucket(subjectId, config.key) < rollout
}
