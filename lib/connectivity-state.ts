export type ConnectivityState = 'offline' | 'poor' | 'online'

export interface ConnectivitySample {
  browserOnline: boolean
  latencyMs?: number | null
  failedRequests: number
}

export function connectivityState(sample: ConnectivitySample): ConnectivityState {
  if (!sample.browserOnline) return 'offline'
  if (sample.failedRequests >= 3) return 'poor'
  if (sample.latencyMs != null && sample.latencyMs > 2_000) return 'poor'
  return 'online'
}

export function shouldQueueMutation(sample: ConnectivitySample): boolean {
  return connectivityState(sample) !== 'online'
}

export function shouldShowConnectivityBanner(sample: ConnectivitySample): boolean {
  return connectivityState(sample) !== 'online'
}
