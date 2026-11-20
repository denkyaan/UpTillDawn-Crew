export interface TimeRange {
  startsAt: number
  endsAt: number
}

export function timeRangeIsValid(range: TimeRange): boolean {
  return Number.isFinite(range.startsAt) && Number.isFinite(range.endsAt) && range.endsAt > range.startsAt
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return timeRangeIsValid(a) && timeRangeIsValid(b) && a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

export function hasDuplicateIds(records: readonly { id: string }[]): boolean {
  const ids = records.map((record) => record.id)
  return new Set(ids).size !== ids.length
}

export function referencesExist(ids: readonly string[], validIds: ReadonlySet<string>): boolean {
  return ids.every((id) => validIds.has(id))
}
