export type DeepLinkTarget = 'event' | 'shift' | 'briefing' | 'task' | 'incident' | 'work-hours'

export interface DeepLink {
  target: DeepLinkTarget
  id?: string | null
  eventId?: string | null
}

export function deepLinkPath(link: DeepLink): string {
  const id = link.id ? encodeURIComponent(link.id) : null
  const eventId = link.eventId ? encodeURIComponent(link.eventId) : null
  if (link.target === 'work-hours') return eventId ? `/work-hours?event=${eventId}` : '/work-hours'
  if (!id) throw new Error(`Missing id for ${link.target}`)
  return `/${link.target}s/${id}${eventId ? `?event=${eventId}` : ''}`
}

export function deepLinkIsContextual(link: DeepLink): boolean {
  return Boolean(link.eventId)
}
