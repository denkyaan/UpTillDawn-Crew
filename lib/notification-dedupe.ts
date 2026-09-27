export interface NotificationFingerprint {
  userId: string
  category: string
  entityId?: string | null
  messageKey: string
  createdAt: number
}

export function notificationFingerprintKey(notification: NotificationFingerprint): string {
  return `${notification.userId}:${notification.category}:${notification.entityId ?? 'none'}:${notification.messageKey}`
}

export function notificationsAreDuplicates(a: NotificationFingerprint, b: NotificationFingerprint, windowMs = 60_000): boolean {
  return notificationFingerprintKey(a) === notificationFingerprintKey(b) && Math.abs(a.createdAt - b.createdAt) <= Math.max(0, windowMs)
}

export function deduplicateNotifications(notifications: readonly NotificationFingerprint[], windowMs = 60_000): NotificationFingerprint[] {
  return notifications.filter((notification, index) => !notifications.slice(0, index).some((previous) => notificationsAreDuplicates(previous, notification, windowMs)))
}
