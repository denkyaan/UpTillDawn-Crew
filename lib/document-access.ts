export type DocumentAudience = 'employee' | 'responsible' | 'admin'
export type EventDocumentKind = 'briefing' | 'safety' | 'map' | 'procedure' | 'permit' | 'technical' | 'crew'

export interface EventDocumentAccess {
  audiences: readonly DocumentAudience[]
  eventId?: string | null
  workplaceId?: string | null
  offlineCritical?: boolean
}

const ROLE_RANK: Record<DocumentAudience, number> = { employee: 1, responsible: 2, admin: 3 }

export function canAccessEventDocument(role: DocumentAudience, access: EventDocumentAccess): boolean {
  return access.audiences.some((audience) => ROLE_RANK[role] >= ROLE_RANK[audience])
}

export function shouldCacheDocumentOffline(access: EventDocumentAccess): boolean {
  return access.offlineCritical === true
}
