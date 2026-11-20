export type OptimisticOperation = 'task-toggle' | 'preference-change' | 'shift-response' | 'checklist-item' | 'workplace-transfer'

export interface OptimisticUpdate {
  id: string
  operation: OptimisticOperation
  rollbackAvailable: boolean
  serverConfirmed: boolean
  failed: boolean
}

export function optimisticUpdateCanApply(update: OptimisticUpdate): boolean {
  return update.rollbackAvailable && !update.serverConfirmed && !update.failed
}

export function optimisticUpdateNeedsRollback(update: OptimisticUpdate): boolean {
  return update.failed && update.rollbackAvailable && !update.serverConfirmed
}

export function optimisticUpdateIsSettled(update: OptimisticUpdate): boolean {
  return update.serverConfirmed || (update.failed && !update.rollbackAvailable)
}
