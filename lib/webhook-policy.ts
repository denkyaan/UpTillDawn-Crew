import type { IntegrationEventName } from './integration-events'

export interface WebhookSubscription {
  id: string
  organizationId: string
  endpoint: string
  enabled: boolean
  events: readonly IntegrationEventName[]
  secretConfigured: boolean
}

export function webhookCanDeliver(subscription: WebhookSubscription, eventName: IntegrationEventName): boolean {
  return subscription.enabled && subscription.secretConfigured && subscription.events.includes(eventName) && subscription.endpoint.startsWith('https://')
}

export function webhookRetryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(0, Math.min(attempt, 8))
  return Math.min(3_600_000, 5_000 * 2 ** safeAttempt)
}

export function webhookShouldRetry(statusCode: number, attempt: number): boolean {
  return attempt < 8 && (statusCode === 408 || statusCode === 429 || statusCode >= 500)
}
