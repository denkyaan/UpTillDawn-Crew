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


function validMinutes(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

export function overtimePolicyIsValid(policy: OvertimePolicy): boolean {
  return typeof policy.excludeBreaks === 'boolean' &&
    (policy.dailyThresholdMinutes == null || validMinutes(policy.dailyThresholdMinutes)) &&
    (policy.weeklyThresholdMinutes == null || validMinutes(policy.weeklyThresholdMinutes)) &&
    (policy.combinationRule == null || ['daily-only','weekly-only','greater-of-daily-or-weekly','additive'].includes(policy.combinationRule)) &&
    (policy.payPeriod == null || ['calendar-week','rolling-7-days'].includes(policy.payPeriod)) &&
    (policy.payrollAuthoritative == null || typeof policy.payrollAuthoritative === 'boolean')
}

function assertValidPolicy(policy: OvertimePolicy): void {
  if (!overtimePolicyIsValid(policy)) throw new Error('Invalid overtime policy')
}

export function netWorkMinutes(summary: WorkPeriodSummary, policy: OvertimePolicy): number {
  assertValidPolicy(policy)
  if (!validMinutes(summary.workedMinutes) || !validMinutes(summary.breakMinutes) || summary.breakMinutes > summary.workedMinutes) throw new Error('Invalid work period summary')
  return summary.workedMinutes - (policy.excludeBreaks ? summary.breakMinutes : 0)
}

export function dailyOvertimeMinutes(summary: WorkPeriodSummary, policy: OvertimePolicy): number {
  assertValidPolicy(policy)
  const threshold = policy.dailyThresholdMinutes
  if (threshold == null) return 0
  return Math.max(0, netWorkMinutes(summary, policy) - Math.max(0, threshold))
}

export function weeklyOvertimeMinutes(netMinutes: number, policy: OvertimePolicy): number {
  assertValidPolicy(policy)
  if (!validMinutes(netMinutes)) throw new Error('Invalid weekly work minutes')
  if (policy.weeklyThresholdMinutes == null) return 0
  return Math.max(0, netMinutes - Math.max(0, policy.weeklyThresholdMinutes))
}

export function overtimePeriodSummary(summary: OvertimePeriodSummary, policy: OvertimePolicy): OvertimeOutput {
  assertValidPolicy(policy)
  if (!Array.isArray(summary.dailyNetMinutes) || !summary.dailyNetMinutes.every(validMinutes) || !validMinutes(summary.weeklyNetMinutes)) throw new Error('Invalid overtime period summary')
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
  return overtimePolicyIsValid(policy) && policy.payrollAuthoritative === true
    && Boolean(policy.policyVersion?.trim())
    && Boolean(policy.effectiveFrom?.trim())
    && (policy.dailyThresholdMinutes != null || policy.weeklyThresholdMinutes != null)
}
