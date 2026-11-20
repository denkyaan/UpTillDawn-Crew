export interface ActionFingerprint {
  actorId: string
  action: string
  entityId?: string | null
  occurredAt: number
}

export function actionFingerprintKey(action: ActionFingerprint): string {
  return `${action.actorId}:${action.action}:${action.entityId ?? 'none'}`
}

export function actionsAreDuplicates(a: ActionFingerprint, b: ActionFingerprint, windowMs = 3_000): boolean {
  return actionFingerprintKey(a) === actionFingerprintKey(b) && Math.abs(a.occurredAt - b.occurredAt) <= Math.max(0, windowMs)
}

export function deduplicateActions(actions: readonly ActionFingerprint[], windowMs = 3_000): ActionFingerprint[] {
  return actions.filter((action, index) => !actions.slice(0, index).some((previous) => actionsAreDuplicates(previous, action, windowMs)))
}
