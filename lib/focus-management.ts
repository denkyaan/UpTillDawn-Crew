export type FocusReturnTarget = 'trigger' | 'heading' | 'first-error' | 'main-content'

export interface FocusTransition {
  openedOverlay: boolean
  closedOverlay: boolean
  validationFailed: boolean
  routeChanged: boolean
}

export function focusReturnTarget(transition: FocusTransition): FocusReturnTarget | null {
  if (transition.validationFailed) return 'first-error'
  if (transition.closedOverlay) return 'trigger'
  if (transition.routeChanged) return 'main-content'
  if (transition.openedOverlay) return 'heading'
  return null
}

export function overlayShouldTrapFocus(transition: FocusTransition): boolean {
  return transition.openedOverlay && !transition.closedOverlay
}
