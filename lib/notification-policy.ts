export type NotificationPriority = 'normal' | 'high' | 'urgent'
export type NotificationChannel = 'in-app' | 'push'
export type NotificationCategory = 'shift' | 'briefing' | 'task' | 'incident' | 'help' | 'planning' | 'system'

export interface NotificationPolicy {
  category: NotificationCategory
  priority: NotificationPriority
  channels: readonly NotificationChannel[]
  bundle: boolean
}

export function notificationPolicy(category: NotificationCategory, urgent = false): NotificationPolicy {
  if (urgent || category === 'incident' || category === 'help') {
    return { category, priority: 'urgent', channels: ['in-app', 'push'], bundle: false }
  }
  if (category === 'shift' || category === 'briefing' || category === 'planning') {
    return { category, priority: 'high', channels: ['in-app', 'push'], bundle: false }
  }
  return { category, priority: 'normal', channels: ['in-app'], bundle: true }
}

export function notificationDeepLink(category: NotificationCategory, entityId?: string): string {
  const routes: Record<NotificationCategory, string> = {
    shift: '/shifts', briefing: '/briefing', task: '/tasks', incident: '/incidents',
    help: '/help', planning: '/events', system: '/notifications',
  }
  const route = routes[category]
  return entityId ? `${route}?id=${encodeURIComponent(entityId)}` : route
}
