export type AuditDataClass = 'security' | 'god-mode' | 'work-hours' | 'operations' | 'notifications'

export interface AuditRetentionRule {
  dataClass: AuditDataClass
  retentionDays: number
  immutable: boolean
}

export const AUDIT_RETENTION: Record<AuditDataClass, AuditRetentionRule> = {
  security: { dataClass: 'security', retentionDays: 365, immutable: true },
  'god-mode': { dataClass: 'god-mode', retentionDays: 365, immutable: true },
  'work-hours': { dataClass: 'work-hours', retentionDays: 365, immutable: true },
  operations: { dataClass: 'operations', retentionDays: 180, immutable: false },
  notifications: { dataClass: 'notifications', retentionDays: 90, immutable: false },
}

export function auditRecordExpired(dataClass: AuditDataClass, occurredAt: number, now = Date.now()): boolean {
  return now - occurredAt > AUDIT_RETENTION[dataClass].retentionDays * 86_400_000
}

export function auditRecordCanMutate(dataClass: AuditDataClass): boolean {
  return !AUDIT_RETENTION[dataClass].immutable
}
