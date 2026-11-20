export interface CoverageRequirement {
  workplaceId: string
  startsAt: number
  endsAt: number
  requiredStaff: number
}

export interface StaffAssignment {
  workplaceId: string
  startsAt: number
  endsAt: number
}

export interface CoverageWindow {
  startsAt: number
  endsAt: number
  assignedStaff: number
  shortfall: number
}

export function assignmentCoversRequirement(assignment: StaffAssignment, requirement: CoverageRequirement): boolean {
  return validCoverageRequirement(requirement) && validStaffAssignment(assignment) && assignment.workplaceId === requirement.workplaceId && assignment.startsAt <= requirement.startsAt && assignment.endsAt >= requirement.endsAt
}

function validCoverageRequirement(requirement: CoverageRequirement): boolean {
  return Boolean(requirement.workplaceId?.trim()) &&
    Number.isFinite(requirement.startsAt) && Number.isFinite(requirement.endsAt) &&
    requirement.startsAt >= 0 && requirement.endsAt > requirement.startsAt &&
    Number.isSafeInteger(requirement.requiredStaff) && requirement.requiredStaff >= 0
}

function validStaffAssignment(assignment: StaffAssignment): boolean {
  return Boolean(assignment.workplaceId?.trim()) &&
    Number.isFinite(assignment.startsAt) && Number.isFinite(assignment.endsAt) &&
    assignment.startsAt >= 0 && assignment.endsAt > assignment.startsAt
}

export function coverageCount(requirement: CoverageRequirement, assignments: readonly StaffAssignment[]): number {
  return assignments.filter((assignment) => assignmentCoversRequirement(assignment, requirement)).length
}

export function coverageShortfall(requirement: CoverageRequirement, assignments: readonly StaffAssignment[]): number {
  if (!validCoverageRequirement(requirement)) return Number.POSITIVE_INFINITY
  return Math.max(0, requirement.requiredStaff - coverageCount(requirement, assignments))
}

export function requirementIsCovered(requirement: CoverageRequirement, assignments: readonly StaffAssignment[]): boolean {
  return coverageShortfall(requirement, assignments) === 0
}

export function coverageWindows(
  requirement: CoverageRequirement,
  assignments: readonly StaffAssignment[],
): CoverageWindow[] {
  if (!validCoverageRequirement(requirement)) {
    return []
  }

  const relevant = assignments.filter((assignment) =>
    assignment.workplaceId === requirement.workplaceId
    && validStaffAssignment(assignment)
    && assignment.endsAt > requirement.startsAt
    && assignment.startsAt < requirement.endsAt
    && assignment.endsAt > assignment.startsAt
  )

  const boundaries = [...new Set([
    requirement.startsAt,
    requirement.endsAt,
    ...relevant.flatMap((assignment) => [
      Math.max(requirement.startsAt, assignment.startsAt),
      Math.min(requirement.endsAt, assignment.endsAt),
    ]),
  ])].sort((a, b) => a - b)

  const windows: CoverageWindow[] = []
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startsAt = boundaries[index]
    const endsAt = boundaries[index + 1]
    if (endsAt <= startsAt) continue

    const segment: CoverageRequirement = {
      workplaceId: requirement.workplaceId,
      startsAt,
      endsAt,
      requiredStaff: Math.max(0, requirement.requiredStaff),
    }
    const assignedStaff = coverageCount(segment, relevant)
    const shortfall = coverageShortfall(segment, relevant)
    const previous = windows[windows.length - 1]

    if (previous?.endsAt === startsAt && previous.assignedStaff === assignedStaff && previous.shortfall === shortfall) {
      previous.endsAt = endsAt
    } else {
      windows.push({ startsAt, endsAt, assignedStaff, shortfall })
    }
  }

  return windows
}
