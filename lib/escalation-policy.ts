export type EscalationType = 'late-check-in' | 'unresolved-help' | 'urgent-incident' | 'unfilled-shift'
export type EscalationTarget = 'responsible' | 'admin'

export interface EscalationContext {
  type: EscalationType
  createdAt: number
  resolvedAt?: number | null
  responsibleAvailable: boolean
}

export function escalationTarget(context: EscalationContext): EscalationTarget {
  if (context.type === 'urgent-incident' || !context.responsibleAvailable) return 'admin'
  return 'responsible'
}

export function escalationDelayMs(type: EscalationType): number {
  if (type === 'urgent-incident') return 0
  if (type === 'late-check-in') return 10 * 60_000
  if (type === 'unresolved-help') return 5 * 60_000
  return 30 * 60_000
}

export function escalationIsDue(context: EscalationContext, now = Date.now()): boolean {
  return !context.resolvedAt && now - context.createdAt >= escalationDelayMs(context.type)
}
