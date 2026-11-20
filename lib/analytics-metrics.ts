export interface OperationalMetricsInput {
  plannedCrew: number
  attendedCrew: number
  noShows: number
  plannedMinutes: number
  workedMinutes: number
  completedTasks: number
  totalTasks: number
  incidentCount: number
  helpResponseMinutes: readonly number[]
}

function safeRatio(part: number, total: number): number {
  return total > 0 ? part / total : 0
}

export function operationalMetrics(input: OperationalMetricsInput) {
  const responseTotal = input.helpResponseMinutes.reduce((sum, value) => sum + Math.max(0, value), 0)
  return {
    attendanceRate: safeRatio(input.attendedCrew, input.plannedCrew),
    noShowRate: safeRatio(input.noShows, input.plannedCrew),
    staffingVarianceMinutes: input.workedMinutes - input.plannedMinutes,
    taskCompletionRate: safeRatio(input.completedTasks, input.totalTasks),
    incidentCount: Math.max(0, input.incidentCount),
    averageHelpResponseMinutes: input.helpResponseMinutes.length ? responseTotal / input.helpResponseMinutes.length : 0,
  }
}
