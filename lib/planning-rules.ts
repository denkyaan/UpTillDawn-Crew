export interface PlannedShift {
  id: string
  userId: string
  startsAt: number
  endsAt: number
  workplaceId?: string | null
}

export type PlanningConflict = 'invalid-range' | 'overlap' | 'insufficient-rest'

export function shiftsOverlap(a: PlannedShift, b: PlannedShift): boolean {
  return a.userId === b.userId && a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

export function detectPlanningConflicts(candidate: PlannedShift, existing: readonly PlannedShift[], minimumRestHours = 0): PlanningConflict[] {
  const conflicts = new Set<PlanningConflict>()
  if (candidate.endsAt <= candidate.startsAt) conflicts.add('invalid-range')
  const restMs = Math.max(0, minimumRestHours) * 3_600_000
  for (const shift of existing) {
    if (shift.id === candidate.id || shift.userId !== candidate.userId) continue
    if (shiftsOverlap(candidate, shift)) conflicts.add('overlap')
    else if (restMs > 0) {
      const gap = candidate.startsAt >= shift.endsAt ? candidate.startsAt - shift.endsAt : shift.startsAt - candidate.endsAt
      if (gap >= 0 && gap < restMs) conflicts.add('insufficient-rest')
    }
  }
  return [...conflicts]
}

export function occupancyStatus(active: number, minimum: number, target?: number): 'understaffed' | 'ok' | 'overstaffed' {
  if (active < Math.max(0, minimum)) return 'understaffed'
  if (target !== undefined && active > Math.max(minimum, target)) return 'overstaffed'
  return 'ok'
}
