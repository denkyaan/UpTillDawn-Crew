export type BulkAction = 'assign-workplace' | 'assign-shift' | 'send-notification' | 'archive' | 'export'

export interface BulkActionRequest {
  action: BulkAction
  entityIds: readonly string[]
  actorId: string
  confirmed: boolean
}

export function normalizedBulkEntityIds(request: BulkActionRequest): string[] {
  return [...new Set(request.entityIds.map((id) => id.trim()).filter(Boolean))]
}

export function bulkActionRequiresConfirmation(action: BulkAction): boolean {
  return action === 'assign-workplace' || action === 'assign-shift' || action === 'send-notification' || action === 'archive'
}

export function bulkActionCanRun(request: BulkActionRequest): boolean {
  const ids = normalizedBulkEntityIds(request)
  return Boolean(request.actorId.trim() && ids.length > 0 && (!bulkActionRequiresConfirmation(request.action) || request.confirmed))
}
