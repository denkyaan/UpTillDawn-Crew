export const MIN_TOUCH_TARGET_PX = 44

export interface InteractiveControl {
  label?: string | null
  ariaLabel?: string | null
  widthPx: number
  heightPx: number
  keyboardReachable: boolean
}

export function interactiveControlIsAccessible(control: InteractiveControl): boolean {
  const named = Boolean(control.label?.trim() || control.ariaLabel?.trim())
  const targetLargeEnough = control.widthPx >= MIN_TOUCH_TARGET_PX && control.heightPx >= MIN_TOUCH_TARGET_PX
  return named && targetLargeEnough && control.keyboardReachable
}

export function prefersReducedMotion(reducedMotion: boolean): 'reduced' | 'full' {
  return reducedMotion ? 'reduced' : 'full'
}
