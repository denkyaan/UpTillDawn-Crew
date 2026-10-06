export interface ComparableEventMetrics {
  crewHours: number
  noShows: number
  incidents: number
  completedTasks: number
  totalTasks: number
}

function delta(current: number, previous: number): number {
  return current - previous
}

function rate(completed: number, total: number): number {
  return total > 0 ? completed / total : 0
}

export function compareEvents(current: ComparableEventMetrics, previous: ComparableEventMetrics) {
  return {
    crewHoursDelta: delta(current.crewHours, previous.crewHours),
    noShowsDelta: delta(current.noShows, previous.noShows),
    incidentsDelta: delta(current.incidents, previous.incidents),
    taskCompletionRateDelta: rate(current.completedTasks, current.totalTasks) - rate(previous.completedTasks, previous.totalTasks),
  }
}
