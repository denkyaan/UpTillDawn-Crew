export type CacheDataClass = 'static' | 'event-read' | 'briefing' | 'documents' | 'live-status' | 'personal' | 'emergency'
export type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only'

export function cacheStrategy(dataClass: CacheDataClass): CacheStrategy {
  if (dataClass === 'static') return 'cache-first'
  if (dataClass === 'briefing' || dataClass === 'documents') return 'stale-while-revalidate'
  if (dataClass === 'event-read' || dataClass === 'emergency') return 'network-first'
  return 'network-only'
}

export function cacheMayContainPersonalData(dataClass: CacheDataClass): boolean {
  return dataClass === 'personal' || dataClass === 'live-status'
}

export function cacheRequiresEncryption(dataClass: CacheDataClass): boolean {
  return cacheMayContainPersonalData(dataClass) || dataClass === 'emergency'
}
