export type SecurityEventType = 'login-failed' | 'login-succeeded' | 'permission-denied' | 'role-changed' | 'api-key-revoked' | 'god-mode-entered' | 'god-mode-change' | 'export-sensitive' | 'session-expired'
export type SecuritySeverity = 'info' | 'warning' | 'high' | 'critical'

export interface SecurityEvent {
  type: SecurityEventType
  actorId?: string | null
  organizationId?: string | null
  severity: SecuritySeverity
  occurredAt: number
  metadata?: Readonly<Record<string, unknown>>
}

export function securityEventRequiresAlert(event: SecurityEvent): boolean {
  return event.severity === 'high' || event.severity === 'critical'
}

export function securityEventIsPrivileged(event: SecurityEvent): boolean {
  return event.type === 'god-mode-entered' || event.type === 'god-mode-change' || event.type === 'role-changed'
}
