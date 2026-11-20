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
  return Object.prototype.hasOwnProperty.call(TRANSITIONS,from) && TRANSITIONS[from].includes(to)
}

export function incidentRequiresImmediatePush(category: IncidentCategory, urgency: IncidentUrgency): boolean {
  if (!['normal','high','urgent'].includes(urgency) || !['medical','safety','security','equipment','technical','staff','general'].includes(category)) return false
  return urgency === 'urgent' || category === 'medical' || category === 'safety' || category === 'security'
}

export function incidentNeedsEscalation(status: IncidentStatus, createdAt: number, now = Date.now(), escalationMinutes = 5): boolean {
  return status === 'new' && Number.isFinite(createdAt) && Number.isFinite(now) &&
    Number.isFinite(escalationMinutes) && escalationMinutes > 0 &&
    createdAt >= 0 && now >= 0 &&
    now >= createdAt && now - createdAt >= escalationMinutes * 60_000
}
