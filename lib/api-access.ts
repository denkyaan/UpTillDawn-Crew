export type ApiScope = 'events:read' | 'events:write' | 'staff:read' | 'shifts:read' | 'shifts:write' | 'tasks:read' | 'tasks:write' | 'incidents:read' | 'reports:read'

export interface ApiCredentialMetadata {
  id: string
  organizationId: string
  name: string
  scopes: readonly ApiScope[]
  revokedAt?: number | null
  expiresAt?: number | null
}

export function apiCredentialIsActive(credential: ApiCredentialMetadata, now = Date.now()): boolean {
  return !credential.revokedAt && (!credential.expiresAt || credential.expiresAt > now)
}

export function apiCredentialHasScope(credential: ApiCredentialMetadata, scope: ApiScope, now = Date.now()): boolean {
  return apiCredentialIsActive(credential, now) && credential.scopes.includes(scope)
}
