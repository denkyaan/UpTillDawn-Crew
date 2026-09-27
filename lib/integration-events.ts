export const INTEGRATION_EVENTS = ['event.created','event.updated','event.phase_changed','shift.created','shift.updated','shift.started','shift.ended','task.created','task.completed','incident.created','incident.resolved'] as const
export type IntegrationEventName = (typeof INTEGRATION_EVENTS)[number]

export interface IntegrationEvent<T = Readonly<Record<string, unknown>>> {
  id: string
  name: IntegrationEventName
  organizationId: string
  entityId: string
  occurredAt: number
  payload: T
}

export function integrationEventIsValid(event: IntegrationEvent): boolean {
  return Boolean(event.id.trim() && event.organizationId.trim() && event.entityId.trim() && INTEGRATION_EVENTS.includes(event.name))
}

export function integrationEventDedupeKey(event: IntegrationEvent): string {
  return `${event.organizationId}:${event.id}`
}
