export type UndoableAction = 'task-complete' | 'assignment-change' | 'notification-dismiss' | 'checklist-item' | 'workplace-transfer'

export interface UndoRecord {
  id: string
  action: UndoableAction
  actorId: string
  createdAt: number
  expiresAt: number
  revertedAt?: number | null
}

export function undoIsAvailable(record: UndoRecord, actorId: string, now = Date.now()): boolean {
  return record.actorId === actorId && !record.revertedAt && record.expiresAt > now
}

export function undoWindowSeconds(record: UndoRecord): number {
  return Math.max(0, Math.floor((record.expiresAt - record.createdAt) / 1000))
}
