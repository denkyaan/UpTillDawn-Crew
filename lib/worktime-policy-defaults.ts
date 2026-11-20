import type { OvertimePolicy } from '@/lib/overtime-policy'

/**
 * Operational review baseline for Belgian event staffing.
 *
 * This is deliberately NOT payroll-authoritative. Belgian overtime entitlement
 * depends on the effective work schedule, collective labour agreement / joint
 * committee, compensatory rest regime and the legal basis for exceeding normal
 * working-time limits.
 */
export const BELGIUM_OPERATIONAL_OVERTIME_POLICY: OvertimePolicy = {
  dailyThresholdMinutes: 9 * 60,
  weeklyThresholdMinutes: 38 * 60,
  excludeBreaks: true,
  combinationRule: 'greater-of-daily-or-weekly',
  payPeriod: 'calendar-week',
  payrollAuthoritative: false,
  policyVersion: 'BE-OPS-2026-09-v1',
  effectiveFrom: '2026-09-27',
}

export const BELGIUM_OPERATIONAL_POLICY_NOTE =
  'Operationele waarschuwingsdrempels; niet gebruiken als automatische loonberekening zonder bevestigde sectorale/ondernemingsregels.'
