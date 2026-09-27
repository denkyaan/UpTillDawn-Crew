export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreaker {
  state: CircuitState
  consecutiveFailures: number
  failureThreshold: number
  openedAt?: number | null
  cooldownMs: number
}

export function circuitShouldOpen(circuit: CircuitBreaker): boolean {
  return circuit.state !== 'open' && circuit.consecutiveFailures >= Math.max(1, circuit.failureThreshold)
}

export function circuitCanProbe(circuit: CircuitBreaker, now = Date.now()): boolean {
  return circuit.state === 'open' && circuit.openedAt != null && now - circuit.openedAt >= Math.max(0, circuit.cooldownMs)
}

export function nextCircuitState(circuit: CircuitBreaker, probeSucceeded?: boolean): CircuitState {
  if (circuitShouldOpen(circuit)) return 'open'
  if (circuitCanProbe(circuit)) return probeSucceeded == null ? 'half-open' : probeSucceeded ? 'closed' : 'open'
  return circuit.state
}
