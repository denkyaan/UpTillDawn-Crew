export type OrganizationRole = 'member' | 'manager' | 'owner'

export interface OrganizationMembership {
  organizationId: string
  userId: string
  role: OrganizationRole
  active: boolean
}

export function activeOrganizationIds(memberships: readonly OrganizationMembership[], userId: string): string[] {
  return memberships.filter((membership) => membership.userId === userId && membership.active).map((membership) => membership.organizationId)
}

export function canAccessOrganization(memberships: readonly OrganizationMembership[], userId: string, organizationId: string): boolean {
  return memberships.some((membership) => membership.userId === userId && membership.organizationId === organizationId && membership.active)
}

export function organizationRole(memberships: readonly OrganizationMembership[], userId: string, organizationId: string): OrganizationRole | null {
  return memberships.find((membership) => membership.userId === userId && membership.organizationId === organizationId && membership.active)?.role ?? null
}
