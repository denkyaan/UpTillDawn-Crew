import type { NotificationCategory, NotificationPriority } from './notification-policy'

export interface BundleCandidate {
  id: string
  eventId?: string | null
  category: NotificationCategory
  priority: NotificationPriority
  createdAt: number
}

export function notificationCanBundle(candidate: BundleCandidate): boolean {
  return Boolean(candidate.id?.trim()) && Number.isFinite(candidate.createdAt) &&
    candidate.priority === 'normal' && ['task','system'].includes(candidate.category) &&
    (candidate.eventId == null || Boolean(candidate.eventId.trim()))
}

export function notificationBundleKey(candidate: BundleCandidate): string | null {
  if (!notificationCanBundle(candidate)) return null
  return `${candidate.eventId ?? 'global'}:${candidate.category}`
}

export function bundleSummary(count: number, eventName?: string | null): string {
  const safeCount = Number.isSafeInteger(count) && count > 0 ? count : 1
  return eventName?.trim() ? `${safeCount} updates for ${eventName.trim()}` : `${safeCount} updates`
}
