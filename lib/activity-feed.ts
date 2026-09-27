export type ActivityEntity = 'event' | 'staff' | 'shift' | 'workplace' | 'task' | 'incident' | 'briefing' | 'automation' | 'god-mode'

export interface ActivityEntry {
  id: string
  actorId: string
  entity: ActivityEntity
  entityId: string
  action: string
  occurredAt: number
  before?: Readonly<Record<string, unknown>> | null
  after?: Readonly<Record<string, unknown>> | null
}

export function changedFields(entry: ActivityEntry): string[] {
  const before = entry.before ?? {}
  const after = entry.after ?? {}
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => before[key] !== after[key])
}

export function activityIsSensitive(entry: ActivityEntry): boolean {
  return entry.entity === 'incident' || entry.entity === 'god-mode'
}
