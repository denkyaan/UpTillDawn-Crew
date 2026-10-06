export type SessionRisk = 'normal' | 'elevated' | 'critical'

export interface SessionContext {
  createdAt: number
  lastActivityAt: number
  risk: SessionRisk
  privileged: boolean
}

export function sessionIdleLimitMinutes(session: SessionContext): number {
  if (session.privileged || session.risk === 'critical') return 15
  if (session.risk === 'elevated') return 60
  return 480
}

export function sessionIsExpired(session: SessionContext, now = Date.now()): boolean {
  return now - session.lastActivityAt >= sessionIdleLimitMinutes(session) * 60_000
}

export function sessionRequiresReauthentication(session: SessionContext): boolean {
  return session.privileged || session.risk === 'critical'
}
