export type EventArchiveState = 'active' | 'completed' | 'archived' | 'restored'

export interface EventArchiveRecord {
  eventId: string
  state: EventArchiveState
  completedAt?: number | null
  archivedAt?: number | null
  restoredAt?: number | null
}

export function eventCanArchive(record: EventArchiveRecord): boolean {
  return record.state === 'completed' && Boolean(record.completedAt)
}

export function eventCanRestore(record: EventArchiveRecord): boolean {
  return record.state === 'archived' && Boolean(record.archivedAt)
}

export function eventIsReadOnly(record: EventArchiveRecord): boolean {
  return record.state === 'archived'
}
