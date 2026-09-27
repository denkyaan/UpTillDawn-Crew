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

export function assignmentCoversRequirement(assignment: StaffAssignment, requirement: CoverageRequirement): boolean {
  return assignment.workplaceId === requirement.workplaceId && assignment.startsAt <= requirement.startsAt && assignment.endsAt >= requirement.endsAt
}

export function coverageCount(requirement: CoverageRequirement, assignments: readonly StaffAssignment[]): number {
  return assignments.filter((assignment) => assignmentCoversRequirement(assignment, requirement)).length
}

export function coverageShortfall(requirement: CoverageRequirement, assignments: readonly StaffAssignment[]): number {
  return Math.max(0, requirement.requiredStaff - coverageCount(requirement, assignments))
}

export function requirementIsCovered(requirement: CoverageRequirement, assignments: readonly StaffAssignment[]): boolean {
  return coverageShortfall(requirement, assignments) === 0
}
