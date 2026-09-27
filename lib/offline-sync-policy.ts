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
  return mutation.status === 'queued' && (mutation.dependsOn ?? []).every((id) => completedIds.has(id))
}

export function retryDelayMs(retryCount: number): number {
  const attempt = Math.max(0, Math.min(retryCount, 6))
  return Math.min(60_000, 1000 * 2 ** attempt)
}

export function shouldRetryMutation(mutation: OfflineMutation): boolean {
  return mutation.status === 'failed' && mutation.retryCount < 6
}
