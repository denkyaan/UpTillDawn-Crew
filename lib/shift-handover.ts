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

export function handoverCanBeAccepted(handover: ShiftHandover): boolean {
  return handover.status === 'ready' && Boolean(handover.incomingResponsibleId)
}

export function handoverHasOpenWork(handover: ShiftHandover): boolean {
  return handover.openTaskIds.length > 0 || handover.openIncidentIds.length > 0
}
