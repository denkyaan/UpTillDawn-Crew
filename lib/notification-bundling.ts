import type { NotificationCategory, NotificationPriority } from './notification-policy'

export interface BundleCandidate {
  id: string
  eventId?: string | null
  category: NotificationCategory
  priority: NotificationPriority
  createdAt: number
}

export function notificationCanBundle(candidate: BundleCandidate): boolean {
  return candidate.priority === 'normal' && candidate.category !== 'incident' && candidate.category !== 'help'
}

export function notificationBundleKey(candidate: BundleCandidate): string | null {
  if (!notificationCanBundle(candidate)) return null
  return `${candidate.eventId ?? 'global'}:${candidate.category}`
}

export function bundleSummary(count: number, eventName?: string | null): string {
  const safeCount = Math.max(1, Math.floor(count))
  return eventName?.trim() ? `${safeCount} updates for ${eventName.trim()}` : `${safeCount} updates`
}
