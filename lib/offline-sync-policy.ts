export type OfflineMutationStatus = 'queued' | 'syncing' | 'synced' | 'conflict' | 'failed'

export interface OfflineMutation {
  id: string
  entity: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  createdAt: number
  dependsOn?: readonly string[]
  retryCount: number
  status: OfflineMutationStatus
}

export function mutationCanSync(mutation: OfflineMutation, completedIds: ReadonlySet<string>): boolean {
  return offlineMutationIsValid(mutation) && mutation.status === 'queued' && (mutation.dependsOn ?? []).every((id) => completedIds.has(id))
}

export function retryDelayMs(retryCount: number): number {
  if (!Number.isSafeInteger(retryCount) || retryCount < 0) throw new Error('Invalid offline retry count')
  const attempt = Math.min(retryCount, 6)
  return Math.min(60_000, 1000 * 2 ** attempt)
}

export function shouldRetryMutation(mutation: OfflineMutation): boolean {
  return offlineMutationIsValid(mutation) && mutation.status === 'failed' && mutation.retryCount < 6
}

/** Validate offline operations before replay to avoid duplicate or circular dependencies. */
export function offlineMutationIsValid(mutation: OfflineMutation): boolean {
  if (!mutation.id?.trim() || !mutation.entity?.trim() || !mutation.entityId?.trim()) return false
  if (!['create','update','delete'].includes(mutation.operation) || !['queued','syncing','synced','conflict','failed'].includes(mutation.status)) return false
  if (!Number.isSafeInteger(mutation.createdAt) || mutation.createdAt < 0 || !Number.isSafeInteger(mutation.retryCount) || mutation.retryCount < 0) return false
  const dependencies = mutation.dependsOn ?? []
  if (!Array.isArray(dependencies) || dependencies.some(id => typeof id !== 'string' || !id.trim() || id === mutation.id)) return false
  return new Set(dependencies).size === dependencies.length
}

/** Returns runnable mutations in deterministic order; rejects missing or circular dependencies. */
export function planOfflineMutations(mutations: readonly OfflineMutation[], completedIds: ReadonlySet<string>): OfflineMutation[] {
  const byId = new Map<string, OfflineMutation>()
  for (const mutation of mutations) {
    if (!offlineMutationIsValid(mutation) || byId.has(mutation.id)) throw new Error('Invalid or duplicate offline mutation')
    byId.set(mutation.id, mutation)
  }
  for (const mutation of mutations) {
    for (const dependency of mutation.dependsOn ?? []) {
      if (!completedIds.has(dependency) && !byId.has(dependency)) throw new Error('Missing offline mutation dependency')
    }
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  function visit(id: string): void {
    if (completedIds.has(id) || visited.has(id)) return
    if (visiting.has(id)) throw new Error('Circular offline mutation dependency')
    const mutation = byId.get(id)
    if (!mutation) return
    visiting.add(id)
    for (const dependency of mutation.dependsOn ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const mutation of mutations) visit(mutation.id)
  return mutations.filter(mutation => !completedIds.has(mutation.id) && mutationCanSync(mutation, completedIds))
    .sort((a,b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

/** Refuse queued replay after logout or an account switch. */
export function ensureOfflineReplayOwner(requestedUserId: string, activeUserId: string | null | undefined, kind: 'operations' | 'uploads'): void {
  if (typeof requestedUserId !== 'string' || !requestedUserId.trim() || requestedUserId !== activeUserId) {
    throw new Error(kind === 'uploads' ? 'UPLOAD_SESSION_MISMATCH' : 'SYNC_SESSION_MISMATCH')
  }
}
