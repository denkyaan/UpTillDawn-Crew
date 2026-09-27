export type OvertimeCombinationRule = 'daily-only' | 'weekly-only' | 'greater-of-daily-or-weekly' | 'additive'
export type PayPeriodKind = 'calendar-week' | 'rolling-7-days'

export interface OvertimePolicy {
  dailyThresholdMinutes?: number | null
  weeklyThresholdMinutes?: number | null
  excludeBreaks: boolean
  combinationRule?: OvertimeCombinationRule
  payPeriod?: PayPeriodKind
  payrollAuthoritative?: boolean
  policyVersion?: string | null
  effectiveFrom?: string | null
}

export interface WorkPeriodSummary {
  workedMinutes: number
  breakMinutes: number
}

export interface OvertimePeriodSummary {
  dailyNetMinutes: readonly number[]
  weeklyNetMinutes: number
}

export interface OvertimeOutput {
  dailyOvertimeMinutes: number
  weeklyOvertimeMinutes: number
  payableOvertimeMinutes: number
  payrollAuthoritative: boolean
  policyVersion: string | null
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

export function overtimePeriodSummary(summary: OvertimePeriodSummary, policy: OvertimePolicy): OvertimeOutput {
  const dailyThreshold = policy.dailyThresholdMinutes
  const daily = dailyThreshold == null
    ? 0
    : summary.dailyNetMinutes.reduce((total, minutes) => total + Math.max(0, minutes - Math.max(0, dailyThreshold)), 0)
  const weekly = weeklyOvertimeMinutes(summary.weeklyNetMinutes, policy)
  const rule = policy.combinationRule ?? 'greater-of-daily-or-weekly'
  const payable =
    rule === 'daily-only' ? daily :
    rule === 'weekly-only' ? weekly :
    rule === 'additive' ? daily + weekly :
    Math.max(daily, weekly)

  return {
    dailyOvertimeMinutes: daily,
    weeklyOvertimeMinutes: weekly,
    payableOvertimeMinutes: payable,
    payrollAuthoritative: policy.payrollAuthoritative === true,
    policyVersion: policy.policyVersion?.trim() || null,
  }
}

export function payrollOvertimeIsEnabled(policy: OvertimePolicy): boolean {
  return policy.payrollAuthoritative === true
    && Boolean(policy.policyVersion?.trim())
    && Boolean(policy.effectiveFrom?.trim())
    && (policy.dailyThresholdMinutes != null || policy.weeklyThresholdMinutes != null)
}
