export interface ReconnectState {
  attempts: number
  connected: boolean
  lastConnectedAt?: number | null
}

export function reconnectDelayMs(attempts: number): number {
  const bounded = Math.max(0, Math.min(attempts, 8))
  return Math.min(30_000, 500 * 2 ** bounded)
}

export function shouldReconnect(state: ReconnectState): boolean {
  return !state.connected && state.attempts < 20
}

export function realtimeConnectionIsStale(state: ReconnectState, now = Date.now(), staleAfterMs = 60_000): boolean {
  return state.connected && state.lastConnectedAt != null && now - state.lastConnectedAt > Math.max(1, staleAfterMs)
}
