export type ErrorSurface = 'page' | 'panel' | 'form' | 'background-sync' | 'notification' | 'pwa'

export interface UiFailure {
  surface: ErrorSurface
  recoverable: boolean
  retryable: boolean
  correlationId: string
}

export function failureAction(failure: UiFailure): 'retry' | 'reload-section' | 'show-fallback' {
  if (failure.retryable) return 'retry'
  if (failure.recoverable) return 'reload-section'
  return 'show-fallback'
}

export function shouldPreserveUserInput(failure: UiFailure): boolean {
  return failure.surface === 'form' || failure.surface === 'background-sync'
}
