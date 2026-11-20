export interface IdempotentMutation {
  idempotencyKey: string
  actorId: string
  operation: string
  entityId?: string | null
}

export function idempotencyKeyIsValid(key: string): boolean {
  const normalized = key.trim()
  return normalized.length >= 16 && normalized.length <= 128 && /^[A-Za-z0-9:_-]+$/.test(normalized)
}

export function mutationDedupeKey(mutation: IdempotentMutation): string {
  return `${mutation.actorId}:${mutation.operation}:${mutation.entityId ?? 'new'}:${mutation.idempotencyKey}`
}

export function idempotentMutationIsValid(mutation: IdempotentMutation): boolean {
  return Boolean(mutation.actorId.trim() && mutation.operation.trim()) && idempotencyKeyIsValid(mutation.idempotencyKey)
}
