import {financeCsv} from './finance-report.ts'

/** Reject blank, exponent, fractional and coerced duration values before exporting payroll. */
function exactSeconds(value:number|string):number {
 if(typeof value==='number'){
  if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid approved payroll row')
  return value
 }
 if(!/^(?:0|[1-9]\\d*)$/.test(value))throw Error('Invalid approved payroll row')
 const parsed=Number(value)
 if(!Number.isSafeInteger(parsed))throw Error('Invalid approved payroll row')
 return parsed
}
function exactUtcTimestamp(value:string):number {
 if(typeof value!=='string'||!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(value))throw Error('Invalid approved payroll row')
 const parsed=Date.parse(value)
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,19)!==value.slice(0,19))throw Error('Invalid approved payroll row')
 return parsed
}
export type PayrollRow={session_id:string;event_id:string;event_name:string;user_id:string;full_name:string|null;timesheet_status:string;started_at:string;ended_at:string;gross_seconds:number|string;break_seconds:number|string;net_seconds:number|string}
/** Approved recorded time for payroll review; never infers wages or statutory overtime. */
export function payrollCsv(rows:readonly PayrollRow[]):string{
 const seen=new Set<string>()
 const output:unknown[][]=[['Session ID','Event ID','Event','User ID','Name','Timesheet status','Start UTC','End UTC','Gross seconds','Break seconds','Net seconds','Net hours']]
 for(const row of rows){
  const gross=exactSeconds(row.gross_seconds),pause=exactSeconds(row.break_seconds),net=exactSeconds(row.net_seconds)
  const start=exactUtcTimestamp(row.started_at),end=exactUtcTimestamp(row.ended_at)
  if(!row.session_id?.trim()||!row.event_id?.trim()||!row.user_id?.trim()||!row.event_name?.trim()||seen.has(row.session_id)||!['approved','locked'].includes(row.timesheet_status)||![gross,pause,net].every(v=>Number.isSafeInteger(v)&&v>=0)||!Number.isFinite(start)||!Number.isFinite(end)||end<start||!Number.isSafeInteger((end-start)/1000)||gross-pause!==net||(end-start)/1000!==gross)throw Error('Invalid approved payroll row')
  seen.add(row.session_id)
  output.push([row.session_id,row.event_id,row.event_name,row.user_id,row.full_name,row.timesheet_status,new Date(start).toISOString(),new Date(end).toISOString(),gross,pause,net,(net/3600).toFixed(6)])
 }
 return financeCsv(output)
}
