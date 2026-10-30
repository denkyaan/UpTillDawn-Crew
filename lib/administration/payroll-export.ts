import {financeCsv} from './finance-report.ts'

export type PayrollRow={session_id:string;event_id:string;event_name:string;user_id:string;full_name:string|null;timesheet_status:string;started_at:string;ended_at:string;gross_seconds:number|string;break_seconds:number|string;net_seconds:number|string}
/** Approved recorded time for payroll review; never infers wages or statutory overtime. */
export function payrollCsv(rows:readonly PayrollRow[]):string{
 const seen=new Set<string>()
 const output:unknown[][]=[['Session ID','Event ID','Event','User ID','Name','Timesheet status','Start UTC','End UTC','Gross seconds','Break seconds','Net seconds','Net hours']]
 for(const row of rows){
  const gross=Number(row.gross_seconds),pause=Number(row.break_seconds),net=Number(row.net_seconds)
  const start=Date.parse(row.started_at),end=Date.parse(row.ended_at)
  if(!row.session_id||seen.has(row.session_id)||!['approved','locked'].includes(row.timesheet_status)||![gross,pause,net].every(v=>Number.isFinite(v)&&v>=0)||!Number.isFinite(start)||!Number.isFinite(end)||end<start||Math.abs(gross-pause-net)>0.001||Math.abs((end-start)/1000-gross)>0.001)throw Error('Invalid approved payroll row')
  seen.add(row.session_id)
  output.push([row.session_id,row.event_id,row.event_name,row.user_id,row.full_name,row.timesheet_status,new Date(start).toISOString(),new Date(end).toISOString(),gross,pause,net,(net/3600).toFixed(6)])
 }
 return financeCsv(output)
}
