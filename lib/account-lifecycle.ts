export type AccountState = 'invited' | 'active' | 'suspended' | 'deactivated'

export interface AccountLifecycle {
  userId: string
  state: AccountState
  changedAt: number
  changedBy: string
  reason?: string | null
}

export function accountCanLogin(account: AccountLifecycle): boolean {
  return account.state === 'active'
}

export function accountChangeRequiresReason(nextState: AccountState): boolean {
  return nextState === 'suspended' || nextState === 'deactivated'
}

export function accountTransitionIsValid(current: AccountState, next: AccountState): boolean {
  if (current === next) return false
  if (current === 'deactivated') return next === 'active'
  return true
}
