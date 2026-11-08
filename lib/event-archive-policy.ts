export type EventArchiveState = 'active' | 'completed' | 'archived' | 'restored'

export interface EventArchiveRecord {
  eventId: string
  state: EventArchiveState
  completedAt?: number | null
  archivedAt?: number | null
  restoredAt?: number | null
}

function validArchiveTimestamp(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function eventCanArchive(record: EventArchiveRecord): boolean {
  return Boolean(record.eventId?.trim()) && record.state === 'completed' && validArchiveTimestamp(record.completedAt) &&
    record.archivedAt == null && record.restoredAt == null
}

export function eventCanRestore(record: EventArchiveRecord): boolean {
  return Boolean(record.eventId?.trim()) && record.state === 'archived' && validArchiveTimestamp(record.archivedAt) &&
    (record.completedAt == null || (validArchiveTimestamp(record.completedAt) && record.completedAt <= record.archivedAt!)) &&
    (record.restoredAt == null || (validArchiveTimestamp(record.restoredAt) && record.restoredAt < record.archivedAt!))
}

export function eventIsReadOnly(record: EventArchiveRecord): boolean {
  return Boolean(record.eventId?.trim()) && record.state === 'archived'
}
