export type DestructiveAction = 'delete-event' | 'delete-user' | 'delete-shift' | 'clear-hours' | 'revoke-api-key' | 'rollback-god-mode'
export type ConfirmationLevel = 'confirm' | 'type-name' | 'reauthenticate'

export function destructiveConfirmationLevel(action: DestructiveAction): ConfirmationLevel {
  if (action === 'delete-event' || action === 'delete-user' || action === 'clear-hours' || action === 'rollback-god-mode') return 'reauthenticate'
  if (action === 'revoke-api-key') return 'type-name'
  return 'confirm'
}

export function destructiveActionRequiresReason(action: DestructiveAction): boolean {
  return action === 'delete-event' || action === 'delete-user' || action === 'clear-hours' || action === 'rollback-god-mode'
}
