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
  const grace = (input.graceMinutes ?? 10) * 60_000
  const maxBreak = (input.maxBreakMinutes ?? 30) * 60_000
  if (!input.checkedInAt && input.now > input.plannedStart + grace) alerts.push('no-show')
  if (input.checkedInAt && input.checkedInAt > input.plannedStart + grace) alerts.push('late-check-in')
  if (input.checkedInAt && !input.checkedOutAt && input.now > input.plannedEnd + grace) alerts.push('shift-overrun')
  if (!input.checkedOutAt && input.now > input.plannedEnd + 2 * grace) alerts.push('missing-checkout')
  if (input.activeBreakStartedAt && input.now - input.activeBreakStartedAt > maxBreak) alerts.push('long-break')
  return alerts
}

export function isUnderstaffed(activeCount: number, minimumRequired: number): boolean {
  return activeCount < Math.max(0, minimumRequired)
}
