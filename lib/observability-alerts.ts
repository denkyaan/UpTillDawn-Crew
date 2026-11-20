import { DEFAULT_SERVICE_LEVELS, serviceLevelMet, type ServiceLevelMetric } from '@/lib/service-levels'

export type ObservabilitySeverity = 'warning' | 'critical'

export interface ObservabilityAlert {
  code: string
  severity: ObservabilitySeverity
  message: string
}

export function healthSnapshotAgeMs(checkedAt: string | number | Date, now = Date.now()): number {
  const checked = checkedAt instanceof Date ? checkedAt.getTime() : typeof checkedAt === 'number' ? checkedAt : Date.parse(checkedAt)
  if (!Number.isFinite(checked)) return Number.POSITIVE_INFINITY
  return Math.max(0, now - checked)
}

export function healthSnapshotAlert(checkedAt: string | number | Date, now = Date.now()): ObservabilityAlert | null {
  const age = healthSnapshotAgeMs(checkedAt, now)
  if (!Number.isFinite(age)) return { code: 'health-snapshot-invalid', severity: 'critical', message: 'Health snapshot heeft geen geldige timestamp.' }
  if (age > 15 * 60_000) return { code: 'health-snapshot-stale-critical', severity: 'critical', message: 'Health snapshot is ouder dan 15 minuten.' }
  if (age > 5 * 60_000) return { code: 'health-snapshot-stale', severity: 'warning', message: 'Health snapshot is ouder dan 5 minuten.' }
  return null
}

export function serviceLevelAlert(metric: ServiceLevelMetric, observed: number): ObservabilityAlert | null {
  const objective = DEFAULT_SERVICE_LEVELS.find(item => item.metric === metric)
  if (!objective || !Number.isFinite(observed) || serviceLevelMet(objective, observed)) return null
  const target = metric === 'api-latency' ? `${objective.target} ms` : `${(objective.target * 100).toFixed(1)}%`
  const value = metric === 'api-latency' ? `${Math.round(observed)} ms` : `${(observed * 100).toFixed(1)}%`
  return {
    code: `slo-${metric}`,
    severity: metric === 'availability' ? 'critical' : 'warning',
    message: `${metric} SLO niet gehaald: ${value} tegenover doel ${target}.`,
  }
}
