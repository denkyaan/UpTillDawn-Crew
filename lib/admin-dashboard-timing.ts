/** Server-only monotonic timing helper. Keep clock reads outside React render source. */
export function dashboardTimestamp(): number {
  return Date.now()
}
