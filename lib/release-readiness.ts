export interface ReleaseCheck {
  name: string
  required: boolean
  passed: boolean
  detail?: string | null
}

export interface ReleaseReadiness {
  ready: boolean
  failedRequiredChecks: readonly string[]
  warnings: readonly string[]
}

export function releaseReadiness(checks: readonly ReleaseCheck[]): ReleaseReadiness {
  const failedRequiredChecks = checks.filter((check) => check.required && !check.passed).map((check) => check.name)
  const warnings = checks.filter((check) => !check.required && !check.passed).map((check) => check.name)
  return { ready: failedRequiredChecks.length === 0, failedRequiredChecks, warnings }
}
