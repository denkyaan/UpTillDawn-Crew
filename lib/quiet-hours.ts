export interface QuietHours {
  enabled: boolean
  startMinute: number
  endMinute: number
}

export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function quietHoursAreActive(quietHours: QuietHours, date: Date): boolean {
  if (!quietHours.enabled) return false
  const minute = minuteOfDay(date)
  const start = Math.max(0, Math.min(1439, quietHours.startMinute))
  const end = Math.max(0, Math.min(1439, quietHours.endMinute))
  if (start === end) return true
  return start < end ? minute >= start && minute < end : minute >= start || minute < end
}

export function notificationMayBypassQuietHours(priority: 'normal' | 'urgent', category: string): boolean {
  return priority === 'urgent' || category === 'incident' || category === 'help'
}
