export interface ResponsibleAssignment {
  userId: string
  workplaceId: string
  startsAt: number
  endsAt: number
}

function validResponsibleAssignment(assignment: ResponsibleAssignment): boolean {
  return Boolean(assignment.userId?.trim() && assignment.workplaceId?.trim()) &&
    Number.isFinite(assignment.startsAt) && Number.isFinite(assignment.endsAt) &&
    assignment.startsAt >= 0 && assignment.endsAt > assignment.startsAt
}

export function responsibleAssignmentsOverlap(a: ResponsibleAssignment, b: ResponsibleAssignment): boolean {
  return validResponsibleAssignment(a) && validResponsibleAssignment(b) && a.userId === b.userId && a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

export function responsibleHasConflict(candidate: ResponsibleAssignment, assignments: readonly ResponsibleAssignment[]): boolean {
  return !validResponsibleAssignment(candidate) || assignments.some((assignment) => responsibleAssignmentsOverlap(candidate, assignment))
}

export function workplaceHasResponsible(workplaceId: string, at: number, assignments: readonly ResponsibleAssignment[]): boolean {
  return Boolean(workplaceId?.trim()) && Number.isFinite(at) && at >= 0 && assignments.some((assignment) => validResponsibleAssignment(assignment) && assignment.workplaceId === workplaceId && assignment.startsAt <= at && assignment.endsAt > at)
}
