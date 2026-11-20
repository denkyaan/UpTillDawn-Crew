export type HandoverStatus = 'draft' | 'ready' | 'accepted'

export interface ShiftHandover {
  id: string
  eventId: string
  workplaceId: string
  outgoingResponsibleId: string
  incomingResponsibleId?: string | null
  status: HandoverStatus
  openTaskIds: readonly string[]
  openIncidentIds: readonly string[]
  equipmentNotes?: string | null
  notes?: string | null
  createdAt: number
  acceptedAt?: number | null
}

function validOpenWorkIds(ids: readonly string[]): boolean {
  return Array.isArray(ids) && ids.every((id) => typeof id === 'string' && Boolean(id.trim())) &&
    new Set(ids.map((id) => id.trim())).size === ids.length
}

export function handoverCanBeAccepted(handover: ShiftHandover): boolean {
  const incoming=handover.incomingResponsibleId?.trim()
  return handover.status === 'ready' && Boolean(
    handover.id?.trim() && handover.eventId?.trim() && handover.workplaceId?.trim() &&
    handover.outgoingResponsibleId?.trim() && incoming &&
    incoming !== handover.outgoingResponsibleId.trim() &&
    Number.isFinite(handover.createdAt) && handover.createdAt >= 0 &&
    (handover.acceptedAt == null) &&
    validOpenWorkIds(handover.openTaskIds) && validOpenWorkIds(handover.openIncidentIds)
  )
}

export function handoverHasOpenWork(handover: ShiftHandover): boolean {
  if (!validOpenWorkIds(handover.openTaskIds) || !validOpenWorkIds(handover.openIncidentIds)) return false
  return handover.openTaskIds.length > 0 || handover.openIncidentIds.length > 0
}
