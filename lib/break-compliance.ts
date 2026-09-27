export interface BreakPolicy {
  workMinutesBeforeBreak: number
  minimumBreakMinutes: number
}

export interface BreakContext {
  workedMinutes: number
  breakMinutes: number
  onBreak: boolean
}

export function breakIsDue(context: BreakContext, policy: BreakPolicy): boolean {
  return !context.onBreak && context.workedMinutes >= policy.workMinutesBeforeBreak && context.breakMinutes < policy.minimumBreakMinutes
}

export function breakRequirementMet(context: BreakContext, policy: BreakPolicy): boolean {
  return context.workedMinutes < policy.workMinutesBeforeBreak || context.breakMinutes >= policy.minimumBreakMinutes
}

export function remainingBreakMinutes(context: BreakContext, policy: BreakPolicy): number {
  return Math.max(0, policy.minimumBreakMinutes - context.breakMinutes)
}
