export interface NoShowContext {
  shiftStartsAt: number
  checkedInAt?: number | null
  excused: boolean
}

export function noShowGraceMinutes(): number {
  return 15
}

export function shiftIsLate(context: NoShowContext, now = Date.now()): boolean {
  return !context.checkedInAt && !context.excused && now > context.shiftStartsAt + 10 * 60_000
}

export function shiftIsNoShow(context: NoShowContext, now = Date.now()): boolean {
  return !context.checkedInAt && !context.excused && now >= context.shiftStartsAt + noShowGraceMinutes() * 60_000
}

export function lateMinutes(context: NoShowContext, now = Date.now()): number {
  if (!shiftIsLate(context, now)) return 0
  return Math.max(0, Math.floor((now - context.shiftStartsAt) / 60_000))
}
