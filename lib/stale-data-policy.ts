export type FreshnessClass = 'live' | 'operational' | 'reference'

export const STALE_AFTER_MS: Record<FreshnessClass, number> = {
  live: 30_000,
  operational: 5 * 60_000,
  reference: 60 * 60_000,
}

export function dataIsStale(updatedAt: number, freshness: FreshnessClass, now = Date.now()): boolean {
  return now - updatedAt > STALE_AFTER_MS[freshness]
}

export function staleDataRequiresRefresh(freshness: FreshnessClass): boolean {
  return freshness === 'live' || freshness === 'operational'
}

export function staleDataMayDisplay(freshness: FreshnessClass): boolean {
  return freshness !== 'live'
}
