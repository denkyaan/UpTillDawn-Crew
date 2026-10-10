import {practiceDoneKey,type PracticeLedger} from "./training-exercise-catalog"

// A single scenario is shared by every chapter of a given trainee's fictional
// curriculum. No network requests or production database writes are made.
export type DemoScenario={
 eventName:string
 crewLimit:number
 workplaceName:string
 shiftTime:string
 briefingName:string
 taskName:string
 approved:boolean
 incidentReported:boolean
 artistArrived:boolean
}
export function demoScenarioFromLedger(ledger:PracticeLedger):DemoScenario{
 const value=(key:string)=>ledger[key]?.value||""
 const label=(key:string,fallback:string)=>value(key).split(" · ")[0]?.trim()||fallback
 const max=Number(value("events:admin:3"))
 return {
  eventName:label("events:admin:0","UpTillDawn Trainingsavond"),
  crewLimit:Number.isFinite(max)&&max>0?max:20,
  workplaceName:label("workplaces:admin:0","Main Bar"),
  shiftTime:value("workplaces:admin:3")||"20:00 → 04:00",
  briefingName:label("briefings:admin:0","Main Bar-briefing"),
  taskName:label("tasks:admin:0","Koeling aanvullen"),
  approved:Boolean(value("personnel:admin:3")),
  incidentReported:Boolean(value("incidents:shared:5")),
  artistArrived:Boolean(value("guestlist:shared:4")),
 }
}
export function readDemoScenario(progressKey:string):DemoScenario{
 if(typeof window==="undefined")return demoScenarioFromLedger({})
 let ledger:PracticeLedger={}
 try{
  const raw=JSON.parse(localStorage.getItem(practiceDoneKey(progressKey))||"{}")
  if(raw&&typeof raw==="object"&&!Array.isArray(raw))ledger=raw
 }catch{}
 return demoScenarioFromLedger(ledger)
}
