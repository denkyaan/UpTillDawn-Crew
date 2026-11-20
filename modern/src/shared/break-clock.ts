// Pure on-device alert; never persisted or used to calculate payroll.
export type BreakAlert="none"|"five_minutes"|"overdue"
export function breakAlert(startedAt:string|null,now:number):BreakAlert{
 if(!startedAt||!Number.isFinite(now))return "none"
 const then=Date.parse(startedAt),elapsed=now-then
 if(!Number.isFinite(then)||elapsed<0)return "none"
 if(elapsed>=70*60000)return "overdue"
 if(elapsed>=55*60000)return "five_minutes"
 return "none"
}
export function formatWorkDuration(seconds:number):string{
 if(!Number.isFinite(seconds)||seconds<0)return "—"
 const minutes=Math.floor(seconds/60)
 return String(Math.floor(minutes/60))+"u "+String(minutes%60).padStart(2,"0")+"m"
}
