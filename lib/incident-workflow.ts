export const INCIDENT_STATUSES = ['new','seen','in-progress','resolved'] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]
export type IncidentUrgency = 'normal' | 'high' | 'urgent'
export type IncidentCategory = 'medical' | 'safety' | 'security' | 'equipment' | 'technical' | 'staff' | 'general'

const TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  new: ['seen','in-progress','resolved'],
  seen: ['in-progress','resolved'],
  'in-progress': ['seen','resolved'],
  resolved: ['in-progress'],
}

export function canTransitionIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function incidentRequiresImmediatePush(category: IncidentCategory, urgency: IncidentUrgency): boolean {
  return urgency === 'urgent' || category === 'medical' || category === 'safety' || category === 'security'
}

export function incidentNeedsEscalation(status: IncidentStatus, createdAt: number, now = Date.now(), escalationMinutes = 5): boolean {
  return status === 'new' && now - createdAt >= Math.max(1, escalationMinutes) * 60_000
}
