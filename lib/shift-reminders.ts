export type ShiftReminderKind = 'day-before' | 'hours-before' | 'start-soon' | 'late-check-in'

export interface ShiftReminderContext {
  shiftStartsAt: number
  checkedInAt?: number | null
}

export function shiftReminderAt(kind: ShiftReminderKind, context: ShiftReminderContext): number {
  if (!Number.isFinite(context.shiftStartsAt) || context.shiftStartsAt < 0 || !['day-before','hours-before','start-soon','late-check-in'].includes(kind)) return Number.NaN
  if (kind === 'day-before') return context.shiftStartsAt - 24 * 60 * 60_000
  if (kind === 'hours-before') return context.shiftStartsAt - 2 * 60 * 60_000
  if (kind === 'start-soon') return context.shiftStartsAt - 15 * 60_000
  return context.shiftStartsAt + 10 * 60_000
}

export function shiftReminderShouldSend(kind: ShiftReminderKind, context: ShiftReminderContext, now = Date.now()): boolean {
  if (!Number.isFinite(context.shiftStartsAt) || context.shiftStartsAt < 0 || !Number.isFinite(now) || now < 0) return false
  if (!['day-before','hours-before','start-soon','late-check-in'].includes(kind)) return false
  if (context.checkedInAt != null && (!Number.isFinite(context.checkedInAt) || context.checkedInAt < 0)) return false
  if (kind === 'late-check-in' && context.checkedInAt != null) return false
  if (context.checkedInAt != null && context.checkedInAt <= now) return false
  if (kind === 'late-check-in' && now < context.shiftStartsAt) return false
  return now >= shiftReminderAt(kind, context)
}
