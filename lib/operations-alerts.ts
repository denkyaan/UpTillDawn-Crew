export type OperationsAlert = 'no-show' | 'late-check-in' | 'shift-overrun' | 'missing-checkout' | 'long-break' | 'understaffed'

export interface ShiftAlertInput {
  now: number
  plannedStart: number
  plannedEnd: number
  checkedInAt?: number | null
  checkedOutAt?: number | null
  activeBreakStartedAt?: number | null
  graceMinutes?: number
  maxBreakMinutes?: number
}

export function detectShiftAlerts(input: ShiftAlertInput): OperationsAlert[] {
  const alerts: OperationsAlert[] = []
  const validTime = (value: number): boolean => Number.isFinite(value) && value >= 0
  if (![input.now,input.plannedStart,input.plannedEnd].every(validTime) || input.plannedEnd <= input.plannedStart) return alerts
  if ([input.checkedInAt,input.checkedOutAt,input.activeBreakStartedAt].some(value => value != null && !validTime(value))) return alerts
  if ([input.graceMinutes ?? 10,input.maxBreakMinutes ?? 30].some(value => !Number.isFinite(value) || value < 0)) return alerts
  const grace = (input.graceMinutes ?? 10) * 60_000
  const maxBreak = (input.maxBreakMinutes ?? 30) * 60_000
  if (input.checkedInAt == null && input.checkedOutAt == null && input.now > input.plannedStart + grace) alerts.push('no-show')
  if (input.checkedInAt != null && input.checkedInAt > input.plannedStart + grace) alerts.push('late-check-in')
  if (input.checkedInAt != null && input.checkedOutAt == null && input.now > input.plannedEnd + grace) alerts.push('shift-overrun')
  if (input.checkedInAt != null && input.checkedOutAt == null && input.now > input.plannedEnd + 2 * grace) alerts.push('missing-checkout')
  if (input.checkedInAt != null && input.checkedOutAt == null && input.activeBreakStartedAt != null && input.activeBreakStartedAt <= input.now && input.now - input.activeBreakStartedAt > maxBreak) alerts.push('long-break')
  return alerts
}

export function isUnderstaffed(activeCount: number, minimumRequired: number): boolean {
  if (![activeCount,minimumRequired].every(value=>Number.isSafeInteger(value) && value>=0)) return true
  return activeCount < minimumRequired
}
