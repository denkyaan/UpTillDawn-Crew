export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface OperationalLog {
  level: LogLevel
  message: string
  occurredAt: number
  correlationId: string
  organizationId?: string | null
  eventId?: string | null
  userId?: string | null
  metadata?: Readonly<Record<string, unknown>>
}

export function operationalLogIsValid(log: OperationalLog): boolean {
  return Boolean(log.message.trim() && log.correlationId.trim()) && Number.isFinite(log.occurredAt)
}

export function logRequiresImmediateAttention(log: OperationalLog): boolean {
  return log.level === 'error'
}

export function scopedCorrelationId(scope: string, id: string): string {
  return `${scope.trim()}:${id.trim()}`
}
