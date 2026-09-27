export interface OvertimePolicy {
  dailyThresholdMinutes?: number | null
  weeklyThresholdMinutes?: number | null
  excludeBreaks: boolean
}

export interface WorkPeriodSummary {
  workedMinutes: number
  breakMinutes: number
}

export function netWorkMinutes(summary: WorkPeriodSummary, policy: OvertimePolicy): number {
  return Math.max(0, summary.workedMinutes - (policy.excludeBreaks ? summary.breakMinutes : 0))
}

export function dailyOvertimeMinutes(summary: WorkPeriodSummary, policy: OvertimePolicy): number {
  const threshold = policy.dailyThresholdMinutes
  if (threshold == null) return 0
  return Math.max(0, netWorkMinutes(summary, policy) - Math.max(0, threshold))
}

export function weeklyOvertimeMinutes(netMinutes: number, policy: OvertimePolicy): number {
  if (policy.weeklyThresholdMinutes == null) return 0
  return Math.max(0, netMinutes - Math.max(0, policy.weeklyThresholdMinutes))
}
