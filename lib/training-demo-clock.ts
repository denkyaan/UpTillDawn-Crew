// Clock accounting for the isolated fictional training event, not payroll.
// The previous phase owns elapsed time until the next transition.
export type TrainingClockPhase =
  | "assigned" | "checked_in" | "working" | "driving" | "at_person"
  | "returning" | "task" | "break" | "resumed" | "incident"
  | "finished" | "timesheet"

export function settleTrainingClock<T extends Record<string,unknown>>(source:T,now:number){
  const rawUpdated=source.clockUpdatedAt
  const recordedAt=typeof rawUpdated==="number"&&Number.isFinite(rawUpdated)&&rawUpdated>0?rawUpdated:now
  const elapsed=Math.max(0,Math.floor((now-recordedAt)/1000))
  const seconds=(field:"workSeconds"|"driveSeconds"|"breakSeconds")=>{
    const value=source[field]
    return typeof value==="number"&&Number.isFinite(value)&&value>=0?value:0
  }
  const phase=String(source.operationPhase||"assigned") as TrainingClockPhase
  const work=phase==="working"||phase==="task"||phase==="resumed"||phase==="incident"
  const drive=phase==="driving"||phase==="returning"
  return {
    ...source,
    workSeconds:seconds("workSeconds")+(work?elapsed:0),
    driveSeconds:seconds("driveSeconds")+(drive?elapsed:0),
    breakSeconds:seconds("breakSeconds")+(phase==="break"?elapsed:0),
    clockUpdatedAt:now,
  }
}
