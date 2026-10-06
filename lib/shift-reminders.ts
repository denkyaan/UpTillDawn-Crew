export type ShiftReminderKind = 'day-before' | 'hours-before' | 'start-soon' | 'late-check-in'

export interface ShiftReminderContext {
  shiftStartsAt: number
  checkedInAt?: number | null
}

export function shiftReminderAt(kind: ShiftReminderKind, context: ShiftReminderContext): number {
  if (kind === 'day-before') return context.shiftStartsAt - 24 * 60 * 60_000
  if (kind === 'hours-before') return context.shiftStartsAt - 2 * 60 * 60_000
  if (kind === 'start-soon') return context.shiftStartsAt - 15 * 60_000
  return context.shiftStartsAt + 10 * 60_000
}

export function shiftReminderShouldSend(kind: ShiftReminderKind, context: ShiftReminderContext, now = Date.now()): boolean {
  if (kind === 'late-check-in' && context.checkedInAt) return false
  return now >= shiftReminderAt(kind, context)
}
