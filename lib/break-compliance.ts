export interface BreakPolicy {
  workMinutesBeforeBreak: number
  minimumBreakMinutes: number
}

export interface BreakContext {
  workedMinutes: number
  breakMinutes: number
  onBreak: boolean
}

function validBreakData(context: BreakContext, policy: BreakPolicy): boolean {
  return Number.isFinite(context.workedMinutes) && context.workedMinutes >= 0 &&
    Number.isFinite(context.breakMinutes) && context.breakMinutes >= 0 &&
    typeof context.onBreak === 'boolean' &&
    Number.isFinite(policy.workMinutesBeforeBreak) && policy.workMinutesBeforeBreak >= 0 &&
    Number.isFinite(policy.minimumBreakMinutes) && policy.minimumBreakMinutes >= 0
}

export function breakIsDue(context: BreakContext, policy: BreakPolicy): boolean {
  return validBreakData(context,policy) && !context.onBreak && context.workedMinutes >= policy.workMinutesBeforeBreak && context.breakMinutes < policy.minimumBreakMinutes
}

export function breakRequirementMet(context: BreakContext, policy: BreakPolicy): boolean {
  return validBreakData(context,policy) && (context.workedMinutes < policy.workMinutesBeforeBreak || context.breakMinutes >= policy.minimumBreakMinutes)
}

export function remainingBreakMinutes(context: BreakContext, policy: BreakPolicy): number {
  if(!validBreakData(context,policy))throw new Error('Invalid break policy or time context')
  return Math.max(0, policy.minimumBreakMinutes - context.breakMinutes)
}
