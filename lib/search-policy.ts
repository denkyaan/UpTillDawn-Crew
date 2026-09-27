import type { Permission } from './permission-matrix'

export type SearchEntity = 'event' | 'staff' | 'shift' | 'workplace' | 'task' | 'incident' | 'briefing'

export interface SearchResult {
  id: string
  entity: SearchEntity
  label: string
  organizationId: string
  requiredPermission?: Permission
}

export function visibleSearchResults(results: readonly SearchResult[], organizationId: string, permissions: ReadonlySet<Permission>): SearchResult[] {
  return results.filter((result) => result.organizationId === organizationId && (!result.requiredPermission || permissions.has(result.requiredPermission)))
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function searchQueryIsUseful(query: string): boolean {
  return normalizeSearchQuery(query).length >= 2
}
