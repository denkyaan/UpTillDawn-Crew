export interface NotificationReadState {
  notificationId: string
  userId: string
  deliveredAt?: number | null
  readAt?: number | null
  dismissedAt?: number | null
}

function validNotificationState(state: NotificationReadState): boolean {
  return Boolean(state.notificationId?.trim() && state.userId?.trim()) &&
    [state.deliveredAt,state.readAt,state.dismissedAt].every(value=>value == null || Number.isFinite(value))
}

export function notificationIsUnread(state: NotificationReadState): boolean {
  return validNotificationState(state) && state.readAt == null && state.dismissedAt == null
}

export function notificationCanMarkRead(state: NotificationReadState): boolean {
  return !state.readAt && !state.dismissedAt
}

export function notificationCanDismiss(state: NotificationReadState): boolean {
  return validNotificationState(state) && state.dismissedAt == null
}

export function unreadNotificationCount(states: readonly NotificationReadState[], userId: string): number {
  if (!userId?.trim()) return 0
  return states.filter((state) => state.userId === userId && notificationIsUnread(state)).length
}
