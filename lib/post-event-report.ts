export interface EventReportInput {
  plannedCrew: number
  attendedCrew: number
  noShows: number
  lateArrivals: number
  plannedMinutes: number
  workedMinutes: number
  breakMinutes: number
  incidents: number
  completedTasks: number
  incompleteTasks: number
}

export interface EventReportSummary extends EventReportInput {
  netWorkedMinutes: number
  varianceMinutes: number
  attendanceRate: number
  taskCompletionRate: number
}

function ratio(part: number, total: number): number {
  return total > 0 ? part / total : 0
}

export function summarizeEventReport(input: EventReportInput): EventReportSummary {
  const netWorkedMinutes = Math.max(0, input.workedMinutes - input.breakMinutes)
  const totalTasks = input.completedTasks + input.incompleteTasks
  return {
    ...input,
    netWorkedMinutes,
    varianceMinutes: netWorkedMinutes - input.plannedMinutes,
    attendanceRate: ratio(input.attendedCrew, input.plannedCrew),
    taskCompletionRate: ratio(input.completedTasks, totalTasks),
  }
}
