/** A chosen Belgian business date expires at the end of that date, including DST. */
export function administrationDeadline(day:string):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Invalid deadline')
 const noon=Date.parse(day+'T12:00:00Z')
 if(!Number.isFinite(noon)||new Date(noon).toISOString().slice(0,10)!==day)throw Error('Invalid deadline')
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',hour:'2-digit',hourCycle:'h23'}).format(new Date(noon)))
 return new Date(Date.parse(day+'T00:00:00Z')+86_399_000-(hour-12)*3_600_000).toISOString()
}
