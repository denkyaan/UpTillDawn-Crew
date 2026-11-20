// Pure audit/reference calculation for the agreed per-event policy.
// This is NOT used to write payroll or override server values.
export const PAID_BREAK_ALLOWANCE_SECONDS=3600
export const BREAK_GRACE_TRIGGER_SECONDS=600
export type BreakPeriod={sessionId:string;start:string;grossSeconds:number;breakSeconds:number}
export type BreakAllocation={sessionId:string;grossSeconds:number;breakSeconds:number;
 deductedSeconds:number;payableSeconds:number}
function integer(value:number):boolean{return Number.isSafeInteger(value)&&value>=0}
export function allocateEventBreaks(periods:readonly BreakPeriod[]):BreakAllocation[]{
 const seen=new Set<string>()
 for(const s of periods){
  if(!s.sessionId||seen.has(s.sessionId)||!Number.isFinite(Date.parse(s.start))||
   !integer(s.grossSeconds)||!integer(s.breakSeconds)||s.breakSeconds>s.grossSeconds)
   throw new Error("invalid_work_period")
  seen.add(s.sessionId)
 }
 const total=periods.reduce((sum,p)=>sum+p.breakSeconds,0)
 if(!integer(total))throw new Error("break_total_overflow")
 let previous=0
 return [...periods].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||
  a.sessionId.localeCompare(b.sessionId)).map(p=>{
  const available=Math.max(0,PAID_BREAK_ALLOWANCE_SECONDS-previous)
  const deduction=total>PAID_BREAK_ALLOWANCE_SECONDS+BREAK_GRACE_TRIGGER_SECONDS?
   Math.max(0,p.breakSeconds-available):0
  previous+=p.breakSeconds
  return {sessionId:p.sessionId,grossSeconds:p.grossSeconds,
   breakSeconds:p.breakSeconds,deductedSeconds:deduction,
   payableSeconds:p.grossSeconds-deduction}
 })
}
