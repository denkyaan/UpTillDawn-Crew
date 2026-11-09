/** Parse and normalize untrusted URL filters for the Administration timesheet workspace. */
export const ADMINISTRATION_TIMESHEET_PAGE_SIZE=25
export const ADMINISTRATION_TIMESHEET_STATUSES=['open','submitted','approved','rejected','locked'] as const
export type AdministrationTimesheetStatus=(typeof ADMINISTRATION_TIMESHEET_STATUSES)[number]
export type AdministrationTimesheetFilters={
 eventFilter:string|null
 userFilter:string|null
 statusFilter:AdministrationTimesheetStatus|null
 page:number
}
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

function uuidOrNull(value:unknown):string|null{
 return typeof value==='string'&&UUID.test(value)?value:null
}

export function parseAdministrationTimesheetFilters(params:{
 event?:unknown
 user?:unknown
 status?:unknown
 page?:unknown
}):AdministrationTimesheetFilters{
 const statusFilter=ADMINISTRATION_TIMESHEET_STATUSES.find(status=>status===params.status)??null
 const page=typeof params.page==='string'&&/^[1-9][0-9]{0,4}$/.test(params.page)
  ?Math.min(Number(params.page),10000):1
 return {
  eventFilter:uuidOrNull(params.event),
  userFilter:uuidOrNull(params.user),
  statusFilter,
  page,
 }
}

/** Canonical same-portal navigation for filters, pagination and review back-links. */
export function administrationTimesheetHref(
 status:AdministrationTimesheetStatus|null,
 page:number,
 event:string|null,
 user:string|null,
):string{
 const query=new URLSearchParams()
 const eventId=uuidOrNull(event)
 const userId=uuidOrNull(user)
 if(eventId)query.set('event',eventId)
 if(userId)query.set('user',userId)
 if(status&&ADMINISTRATION_TIMESHEET_STATUSES.includes(status))query.set('status',status)
 if(Number.isSafeInteger(page)&&page>1&&page<=10000)query.set('page',String(page))
 const suffix=query.toString()
 return '/portals/administration/timesheets'+(suffix?'?'+suffix:'')
}
