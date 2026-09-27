import type { NotificationCategory, NotificationChannel, NotificationPriority } from './notification-policy'

export interface NotificationPreference {
  category: NotificationCategory
  inApp: boolean
  push: boolean
}

export function channelsForPreference(preference: NotificationPreference, priority: NotificationPriority): readonly NotificationChannel[] {
  if (priority === 'urgent') return ['in-app','push']
  const channels: NotificationChannel[] = []
  if (preference.inApp) channels.push('in-app')
  if (preference.push) channels.push('push')
  return channels
}

export function defaultNotificationPreference(category: NotificationCategory): NotificationPreference {
  return {
    category,
    inApp: true,
    push: category === 'shift' || category === 'briefing' || category === 'incident' || category === 'help' || category === 'planning',
  }
}

export function notificationCategoryIsOperationallyCritical(category: NotificationCategory): boolean {
  return category === 'incident' || category === 'help'
}

export function effectiveChannelsForPreference(preference: NotificationPreference, priority: NotificationPriority): readonly NotificationChannel[] {
  if (priority === 'urgent' || notificationCategoryIsOperationallyCritical(preference.category)) return ['in-app','push']
  return channelsForPreference(preference, priority)
}
