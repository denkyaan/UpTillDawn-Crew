export interface ScheduledCoverageShift {
  userId: string
  workplaceId: string
  startsAt: number
  endsAt: number
}

export interface ResponsibleWorkplaceAssignment {
  userId: string
  workplaceId: string
}

export interface ResponsibleCoverageGap {
  startsAt: number
  endsAt: number
}

function validShift(shift: ScheduledCoverageShift): boolean {
  return Number.isFinite(shift.startsAt) && Number.isFinite(shift.endsAt) && shift.endsAt > shift.startsAt
}

export function responsibleCoverageGaps(
  workplaceId: string,
  shifts: readonly ScheduledCoverageShift[],
  assignments: readonly ResponsibleWorkplaceAssignment[],
): ResponsibleCoverageGap[] {
  const workplaceShifts = shifts.filter((shift) => shift.workplaceId === workplaceId && validShift(shift))
  if (!workplaceShifts.length) return []

  const responsibleIds = new Set(
    assignments
      .filter((assignment) => assignment.workplaceId === workplaceId)
      .map((assignment) => assignment.userId),
  )
  const boundaries = [...new Set(workplaceShifts.flatMap((shift) => [shift.startsAt, shift.endsAt]))].sort((a, b) => a - b)
  const gaps: ResponsibleCoverageGap[] = []

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startsAt = boundaries[index]
    const endsAt = boundaries[index + 1]
    if (endsAt <= startsAt) continue

    const active = workplaceShifts.filter((shift) => shift.startsAt < endsAt && shift.endsAt > startsAt)
    if (!active.length) continue
    if (active.some((shift) => responsibleIds.has(shift.userId))) continue

    const previous = gaps[gaps.length - 1]
    if (previous?.endsAt === startsAt) previous.endsAt = endsAt
    else gaps.push({ startsAt, endsAt })
  }

  return gaps
}

export function responsibleCoverageIsComplete(
  workplaceId: string,
  shifts: readonly ScheduledCoverageShift[],
  assignments: readonly ResponsibleWorkplaceAssignment[],
): boolean {
  return responsibleCoverageGaps(workplaceId, shifts, assignments).length === 0
}
