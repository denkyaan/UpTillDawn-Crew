export interface NotificationReadState {
  notificationId: string
  userId: string
  deliveredAt?: number | null
  readAt?: number | null
  dismissedAt?: number | null
}

export function notificationIsUnread(state: NotificationReadState): boolean {
  return !state.readAt && !state.dismissedAt
}

export function notificationCanMarkRead(state: NotificationReadState): boolean {
  return !state.readAt && !state.dismissedAt
}

export function notificationCanDismiss(state: NotificationReadState): boolean {
  return !state.dismissedAt
}

export function unreadNotificationCount(states: readonly NotificationReadState[], userId: string): number {
  return states.filter((state) => state.userId === userId && notificationIsUnread(state)).length
}
