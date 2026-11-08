export interface ReconnectState {
  attempts: number
  connected: boolean
  lastConnectedAt?: number | null
}

export function reconnectDelayMs(attempts: number): number {
  if (!Number.isSafeInteger(attempts) || attempts < 0) throw new Error('Invalid reconnect attempt count')
  const bounded = Math.min(attempts, 8)
  return Math.min(30_000, 500 * 2 ** bounded)
}

export function shouldReconnect(state: ReconnectState): boolean {
  return typeof state.connected === 'boolean' && !state.connected && Number.isSafeInteger(state.attempts) && state.attempts >= 0 && state.attempts < 20
}

export function realtimeConnectionIsStale(state: ReconnectState, now = Date.now(), staleAfterMs = 60_000): boolean {
  return state.connected === true && Number.isFinite(state.lastConnectedAt) && state.lastConnectedAt! >= 0 && Number.isFinite(now) && now >= state.lastConnectedAt! && Number.isFinite(staleAfterMs) && staleAfterMs > 0 && now - state.lastConnectedAt! > staleAfterMs
}
