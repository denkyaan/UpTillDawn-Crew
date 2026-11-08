/**
 * V2.1 portal authorization model.
 * This is a presentation helper only: database RLS/RPC remains authoritative.
 * Never derive assignments from user-editable JWT metadata.
 */
export const PORTALS = ["events", "promotion", "administration"] as const
export type Portal = (typeof PORTALS)[number]
export type PortalRole = "event_staff" | "event_responsible" | "promoter" | "administrative_staff" | "admin"
export type PortalAssignment = {
  portal: Portal
  role: PortalRole
  approved: boolean
  revoked_at: string | null
}

const allowedRoles: Readonly<Record<Portal, readonly PortalRole[]>> = {
  events: ["event_staff", "event_responsible", "admin"],
  promotion: ["promoter", "admin"],
  administration: ["administrative_staff", "admin"],
}

export function accessiblePortals(
  assignments: readonly PortalAssignment[],
  account: { approved: boolean; blocked: boolean },
): Portal[] {
  if (!account.approved || account.blocked) return []
  return PORTALS.filter(portal =>
    assignments.some(assignment =>
      assignment.portal === portal &&
      assignment.approved &&
      assignment.revoked_at === null &&
      allowedRoles[portal].includes(assignment.role),
    ),
  )
}

export function canOpenPortal(
  portal: string,
  assignments: readonly PortalAssignment[],
  account: { approved: boolean; blocked: boolean },
): portal is Portal {
  return accessiblePortals(assignments, account).some(value => value === portal)
}

/** Accept only same-origin relative paths for notification destinations. */
export function safeNotificationPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") ||
      value.startsWith("//") || value.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(value)) return "/notifications"
  const rawPath = value.split(/[?#]/, 1)[0]
  if (/%(?:2e|2f|5c|0[0-9a-f]|1[0-9a-f]|7f|25(?:2e|2f|5c|0[0-9a-f]|1[0-9a-f]|7f))/i.test(rawPath) ||
      rawPath.split("/").includes("..")) return "/notifications"
  let url: URL
  try { url = new URL(value, "https://uptilldawn.local") }
  catch { return "/notifications" }
  if (url.origin !== "https://uptilldawn.local") return "/notifications"
  const normalizedPath = rawPath.replace(/\/\.\//g, "/").replace(/\/\.$/, "/")
  if (normalizedPath !== url.pathname) return "/notifications"
  return url.pathname + url.search + url.hash
}
