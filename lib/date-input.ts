/** Convert stored UTC instants to a datetime-local value with an explicit offset. */
export function localDateInputValue(iso:string,offsetMinutes:number):string{
 if(!iso||!Number.isFinite(offsetMinutes))return ''
 const date=new Date(iso)
 if(!Number.isFinite(date.getTime()))return ''
 const local=new Date(date.getTime()-offsetMinutes*60_000)
 return Number.isFinite(local.getTime())?local.toISOString().slice(0,16):''
}

export function localDateInputLabel(name:string):string{
 if(name.includes('deadline'))return 'Aanmelddeadline'
 return name.includes('end')?'Einde':'Begin'
}
