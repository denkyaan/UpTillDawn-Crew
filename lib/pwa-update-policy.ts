export type PwaUpdateState = 'idle' | 'available' | 'installing' | 'ready' | 'failed'

export interface PwaUpdateContext {
  state: PwaUpdateState
  hasUnsyncedMutations: boolean
  activeShift: boolean
}

export function canActivatePwaUpdate(context: PwaUpdateContext): boolean {
  return context.state === 'ready' && !context.hasUnsyncedMutations
}

export function shouldDeferPwaUpdate(context: PwaUpdateContext): boolean {
  return context.hasUnsyncedMutations || (context.activeShift && context.state !== 'failed')
}

export function shouldShowUpdateBanner(context: PwaUpdateContext): boolean {
  return context.state === 'available' || context.state === 'ready'
}
