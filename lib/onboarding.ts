export const ONBOARDING_STEPS = ['account','profile','address','emergency-contact','documents','rules','availability','briefing','approval'] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

export interface OnboardingProgress {
  completed: readonly OnboardingStep[]
}

export function onboardingCompletion(progress: OnboardingProgress): number {
  const completed = new Set(progress.completed)
  return Math.round((ONBOARDING_STEPS.filter((step) => completed.has(step)).length / ONBOARDING_STEPS.length) * 100)
}

export function missingOnboardingSteps(progress: OnboardingProgress): OnboardingStep[] {
  const completed = new Set(progress.completed)
  return ONBOARDING_STEPS.filter((step) => !completed.has(step))
}

export function onboardingIsComplete(progress: OnboardingProgress): boolean {
  return missingOnboardingSteps(progress).length === 0
}
