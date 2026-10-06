export type ConflictResolution = 'keep-local' | 'keep-remote' | 'manual-merge'

export interface SyncConflict<T> {
  entityId: string
  base: T
  local: T
  remote: T
  detectedAt: number
}

export interface ConflictDecision<T> {
  resolution: ConflictResolution
  value?: T
}

export function conflictDecisionIsValid<T>(decision: ConflictDecision<T>): boolean {
  if (decision.resolution === 'manual-merge') return decision.value !== undefined
  return true
}

export function resolveConflict<T>(conflict: SyncConflict<T>, decision: ConflictDecision<T>): T {
  if (!conflictDecisionIsValid(decision)) throw new Error('Manual merge requires a value')
  if (decision.resolution === 'keep-local') return conflict.local
  if (decision.resolution === 'keep-remote') return conflict.remote
  return decision.value as T
}
