export type RequestClass = 'interactive' | 'mutation' | 'search' | 'export' | 'background'

export const REQUEST_TIMEOUT_MS: Record<RequestClass, number> = {
  interactive: 8_000,
  mutation: 12_000,
  search: 5_000,
  export: 60_000,
  background: 30_000,
}

export function requestTimeoutMs(requestClass: RequestClass): number {
  if (!Object.prototype.hasOwnProperty.call(REQUEST_TIMEOUT_MS,requestClass)) throw new Error('Invalid request class')
  return REQUEST_TIMEOUT_MS[requestClass]
}

export function requestTimedOut(startedAt: number, requestClass: RequestClass, now = Date.now()): boolean {
  const timeout = requestTimeoutMs(requestClass)
  return Number.isFinite(startedAt) && startedAt >= 0 && Number.isFinite(now) && now >= startedAt && now - startedAt >= timeout
}
