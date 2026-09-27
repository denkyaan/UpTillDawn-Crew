export type RateLimitAction = 'login' | 'password-reset' | 'push-send' | 'export' | 'import' | 'incident-create' | 'god-mode-change' | 'api-write'

export interface RateLimitRule {
  action: RateLimitAction
  limit: number
  windowSeconds: number
}

export const DEFAULT_RATE_LIMITS: readonly RateLimitRule[] = [
  { action: 'login', limit: 10, windowSeconds: 60 },
  { action: 'password-reset', limit: 5, windowSeconds: 3600 },
  { action: 'push-send', limit: 120, windowSeconds: 60 },
  { action: 'export', limit: 10, windowSeconds: 300 },
  { action: 'import', limit: 10, windowSeconds: 300 },
  { action: 'incident-create', limit: 30, windowSeconds: 60 },
  { action: 'god-mode-change', limit: 60, windowSeconds: 60 },
  { action: 'api-write', limit: 300, windowSeconds: 60 },
]

export function rateLimitRule(action: RateLimitAction): RateLimitRule {
  return DEFAULT_RATE_LIMITS.find((rule) => rule.action === action) ?? { action, limit: 1, windowSeconds: 60 }
}
