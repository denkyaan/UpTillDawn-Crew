export type DependencyHealth = 'healthy' | 'degraded' | 'unavailable'

export interface DependencyCheck {
  name: string
  health: DependencyHealth
  latencyMs?: number | null
  checkedAt: number
}

export function aggregateDependencyHealth(checks: readonly DependencyCheck[]): DependencyHealth {
  if (checks.some((check) => check.health === 'unavailable')) return 'unavailable'
  if (checks.some((check) => check.health === 'degraded')) return 'degraded'
  return 'healthy'
}

export function dependencyIsSlow(check: DependencyCheck, thresholdMs = 1000): boolean {
  return check.latencyMs != null && check.latencyMs > Math.max(0, thresholdMs)
}
