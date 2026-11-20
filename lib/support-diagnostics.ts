export interface DiagnosticSnapshot {
  appVersion: string
  platform: string
  online: boolean
  pendingSyncCount: number
  lastSyncAt?: number | null
  locale: string
  correlationId?: string | null
}

export interface DiagnosticBundle extends DiagnosticSnapshot {
  generatedAt: number
  includesPersonalData: false
}

export function buildDiagnosticBundle(snapshot: DiagnosticSnapshot, now = Date.now()): DiagnosticBundle {
  return { ...snapshot, generatedAt: now, includesPersonalData: false }
}

export function diagnosticsShowSyncProblem(snapshot: DiagnosticSnapshot, now = Date.now()): boolean {
  if (snapshot.pendingSyncCount <= 0) return false
  if (!snapshot.lastSyncAt) return true
  return now - snapshot.lastSyncAt > 5 * 60_000
}
