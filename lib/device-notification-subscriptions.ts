export interface DevicePushSubscription {
  id: string
  userId: string
  endpointHash: string
  platform: 'ios' | 'android' | 'windows' | 'web' | 'unknown'
  enabled: boolean
  lastSeenAt: number
  failedDeliveries: number
}

export function pushSubscriptionIsUsable(subscription: DevicePushSubscription): boolean {
  return subscription.enabled && subscription.failedDeliveries < 3
}

export function shouldDisablePushSubscription(subscription: DevicePushSubscription): boolean {
  return subscription.failedDeliveries >= 3
}

export function activePushSubscriptions(subscriptions: readonly DevicePushSubscription[], userId: string): DevicePushSubscription[] {
  return subscriptions.filter((subscription) => subscription.userId === userId && pushSubscriptionIsUsable(subscription))
}
