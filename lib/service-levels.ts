export type ServiceLevelMetric = 'availability' | 'api-latency' | 'sync-success' | 'push-delivery'

export interface ServiceLevelObjective {
  metric: ServiceLevelMetric
  target: number
  windowMinutes: number
}

export const DEFAULT_SERVICE_LEVELS: readonly ServiceLevelObjective[] = [
  { metric: 'availability', target: 0.999, windowMinutes: 43_200 },
  { metric: 'api-latency', target: 1000, windowMinutes: 60 },
  { metric: 'sync-success', target: 0.995, windowMinutes: 1440 },
  { metric: 'push-delivery', target: 0.98, windowMinutes: 1440 },
]

export function serviceLevelMet(objective: ServiceLevelObjective, observed: number): boolean {
  if (objective.metric === 'api-latency') return observed <= objective.target
  return observed >= objective.target
}
