export interface PlannedShift {
  id: string
  userId: string
  startsAt: number
  endsAt: number
  workplaceId?: string | null
}

export type PlanningConflict = 'invalid-range' | 'overlap' | 'insufficient-rest'

function validPlannedShift(shift: PlannedShift): boolean {
  return Boolean(shift.id?.trim() && shift.userId?.trim()) &&
    Number.isFinite(shift.startsAt) && Number.isFinite(shift.endsAt) &&
    shift.startsAt >= 0 && shift.endsAt > shift.startsAt
}

export function shiftsOverlap(a: PlannedShift, b: PlannedShift): boolean {
  return validPlannedShift(a) && validPlannedShift(b) && a.userId === b.userId && a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

export function detectPlanningConflicts(candidate: PlannedShift, existing: readonly PlannedShift[], minimumRestHours = 0): PlanningConflict[] {
  const conflicts = new Set<PlanningConflict>()
  if (!validPlannedShift(candidate) || !Number.isFinite(minimumRestHours) || minimumRestHours < 0) conflicts.add('invalid-range')
  if (conflicts.has('invalid-range')) return [...conflicts]
  const restMs = minimumRestHours * 3_600_000
  if (!Number.isFinite(restMs)) return ['invalid-range']
  for (const shift of existing) {
    if (shift.id === candidate.id || shift.userId !== candidate.userId) continue
    if (!validPlannedShift(shift)) { conflicts.add('invalid-range'); continue }
    if (shiftsOverlap(candidate, shift)) conflicts.add('overlap')
    else if (restMs > 0) {
      const gap = candidate.startsAt >= shift.endsAt ? candidate.startsAt - shift.endsAt : shift.startsAt - candidate.endsAt
      if (gap >= 0 && gap < restMs) conflicts.add('insufficient-rest')
    }
  }
  return [...conflicts]
}

export function occupancyStatus(active: number, minimum: number, target?: number): 'understaffed' | 'ok' | 'overstaffed' {
  if (![active,minimum].every(value=>Number.isSafeInteger(value) && value>=0) || (target!==undefined && (!Number.isSafeInteger(target) || target<0))) return 'understaffed'
  if (active < minimum) return 'understaffed'
  if (target !== undefined && active > Math.max(minimum, target)) return 'overstaffed'
  return 'ok'
}
