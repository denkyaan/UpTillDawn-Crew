export interface ResponsibleAssignment {
  userId: string
  workplaceId: string
  startsAt: number
  endsAt: number
}

export function responsibleAssignmentsOverlap(a: ResponsibleAssignment, b: ResponsibleAssignment): boolean {
  return a.userId === b.userId && a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

export function responsibleHasConflict(candidate: ResponsibleAssignment, assignments: readonly ResponsibleAssignment[]): boolean {
  return assignments.some((assignment) => responsibleAssignmentsOverlap(candidate, assignment))
}

export function workplaceHasResponsible(workplaceId: string, at: number, assignments: readonly ResponsibleAssignment[]): boolean {
  return assignments.some((assignment) => assignment.workplaceId === workplaceId && assignment.startsAt <= at && assignment.endsAt > at)
}
